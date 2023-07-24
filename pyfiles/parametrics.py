# didn't actually check these are all needed
import numpy as np
import math
from scipy.spatial import distance

# visualization
from scipy.spatial import Voronoi, voronoi_plot_2d
from scipy.ndimage import gaussian_filter1d
from scipy.stats import qmc
import matplotlib.pyplot as plt
import matplotlib as mpl
from matplotlib.colors import ListedColormap, LinearSegmentedColormap

def ellipse_example(numpts=7, display=False):
    # parametric eq for ellipse:
    # $F(t) = (x(t), y(t))$, where $x(t) = a*cos(t)$ and $y(t) = b*sin(t)$

    # parameters for ellipse shape and sampling density
    a = 5
    b = 2

    # c is number of points
    c = numpts
    t = np.arange(0.0, 6.28, 6.28 / c)
    if display:
        fig, (ax1, ax2) = plt.subplots(1, 2, sharey = True)
    x = a * np.cos(t)
    y = b * np.sin(t)
    points = np.array(list(zip(x, y)))
    vor = Voronoi(points)

    if display:
        # plot ellipse
        num = 10
        ax1.set_xlim(-(max(a, b) + num), (max(a, b) + num))
        ax1.set_ylim(-(max(a, b) + num), (max(a, b) + num))
        ax1.set_aspect("equal")
        ax1.plot(x, y, "o")

        # plot voronoi stuff
        ax2.set_xlim(-(max(a, b) + 1), (max(a, b) + 1))
        ax2.set_ylim(-(max(a, b) + 1), (max(a, b) + 1))
        ax2.set_aspect("equal")
        voronoi_plot_2d(
            vor,
            ax2,
            show_vertices=True,
            line_alpha=0,
            show_points=True,
            point_colors="orange",
            point_size=10,
        )

        fig.set_figwidth(30)
        fig.set_figheight(30)
        plt.show()
    return points


def bumped_ellipse_example(
    numpts=70, display=False, bump=0.5, k=0.4, smooth=1, leftpt=0, rightpt=2
):
    # parametric equation for ellipse:
    # F(t) = (x(t), y(t)), where x(t) = a*cos(t) and y(t) = b*sin(t) + bump*sin(t)

    # parameters for ellipse shape and sampling density
    a = 5
    b = 2

    # number of points
    t = np.linspace(0, 2 * np.pi, numpts, endpoint=False)
    x = a * np.cos(t)
    y = b * np.sin(t)
    # on the top half of the ellipse, when y > 0,
    # a bump function is added
    y2 = y + np.where(y > 0, bump * np.sin(k * t), 0)

    bumprange = set({})
    # we only want a small bump, so between leftpt and rightpt
    for i in range(len(x)):
        if x[i] > leftpt and x[i] < rightpt and y[i] > 0:
            # here we update the y coord
            y[i] = y2[i]
            # we want to know the indices of the bumped y coords,
            # as well as just before and just after, if we want to
            # smooth out the bump
            bumprange.add(i - 1)
            bumprange.add(i)
            bumprange.add(i + 1)

    # these are the bumped indices and a small nbhd
    bumprange = list(bumprange)

    # instead of indices, we want the actual vert locations
    yinrange = []
    for i in range(len(bumprange)):
        yinrange.append(y[bumprange[i]])

    # now we want to rearrange the bump verts to be smoother
    # then we should reinsert them in the same indices
    smoothbump = gaussian_filter1d(np.array(yinrange), smooth)
    j = 0
    for i in bumprange:
        y[i] = smoothbump[j]
        j += 1

    points = np.column_stack((x, y))

    if display:
        fig, ax = plt.subplots()
        ax.set_aspect("equal")
        ax.plot(x, y, "-o")
        plt.show()

    return points


def more_bumps_ellipse_example(
    numpts=70, display=False, bump=0.5, k=0.4, smooth=1, bumpends=[[0, 2]]
):
    # parametric equation for ellipse:
    # F(t) = (x(t), y(t)), where x(t) = a*cos(t) and y(t) = b*sin(t) + bump*sin(t)

    # parameters for ellipse shape and sampling density
    a = 5
    b = 2

    # number of points
    t = np.linspace(0, 2 * np.pi, numpts, endpoint=False)
    x = a * np.cos(t)
    y = b * np.sin(t)
    # on the top half of the ellipse, when y > 0,
    # a bump function is added
    y2 = y + np.where(y > 0, bump * np.sin(k * t), 0)

    bumprange = set({})
    # we only want a small bump, so between leftpt and rightpt
    for b in range(len(bumpends)):
        for i in range(len(x)):
            if x[i] > bumpends[b][0] and x[i] < bumpends[b][1] and y[i] > 0:
                # here we update the y coord
                y[i] = y2[i]
                # we want to know the indices of the bumped y coords,
                # as well as just before and just after, if we want to
                # smooth out the bump
                bumprange.add(i - 2)
                bumprange.add(i - 1)
                bumprange.add(i)
                bumprange.add(i + 1)
                bumprange.add(i + 2)

    # these are the bumped indices and a small nbhd
    bumprange = list(bumprange)

    # instead of indices, we want the actual vert locations
    yinrange = []
    for i in range(len(bumprange)):
        yinrange.append(y[bumprange[i]])

    # now we want to rearrange the bump verts to be smoother
    # then we should reinsert them in the same indices
    smoothbump = gaussian_filter1d(np.array(yinrange), smooth)
    j = 0
    for i in bumprange:
        y[i] = smoothbump[j]
        j += 1

    points = np.column_stack((x, y))

    if display:
        fig, ax = plt.subplots()
        ax.set_aspect("equal")
        ax.plot(x, y, "-o")
        plt.show()

    return points


def rectangle_example(numpts=4, display=False):
    # note: this goes in cw order, hopefully not an issue
    # parameters for rectangle shape and sampling density
    width = 8
    height = 4

    # calculate points on the boundary of the rectangle
    x1 = np.linspace(-width / 2, width / 2, num=numpts // 4 + 1)[:-1]
    y1 = np.full_like(x1, height / 2)

    x2 = np.full_like(y1, width / 2)
    y2 = np.linspace(height / 2, -height / 2, num=numpts // 4 + 1)[:-1]

    x3 = np.linspace(width / 2, -width / 2, num=numpts // 4 + 1)[:-1]
    y3 = np.full_like(x3, -height / 2)

    x4 = np.full_like(y3, -width / 2)
    y4 = np.linspace(-height / 2, height / 2, num=numpts // 4 + 1)[:-1]

    x = np.concatenate([x1, x2, x3, x4])
    y = np.concatenate([y1, y2, y3, y4])
    points = np.array(list(zip(x, y)))

    if display:
        # plot rectangle
        fig, ax1 = plt.subplots(figsize=(10, 4))
        ax1.set_xlim(-width / 2 - 1, width / 2 + 1)
        ax1.set_ylim(-height / 2 - 1, height / 2 + 1)
        ax1.set_aspect("equal")
        ax1.plot(x, y, "o", linewidth=2)
        plt.show()

    return points


def epicycloid_example(numpts=200, display=False):
    # parametric equation for heart shape
    # x = 16 sin^3(t)
    # y = 13 cos(t) - 5 cos(2t) - 2 cos(3t) - cos(4t)

    # parameters for sampling density
    t = np.linspace(0, 2 * np.pi, numpts)
    x = 4 * np.cos(t) - np.cos(4 * t)
    y = 4 * np.sin(t) - np.sin(4 * t)
    points = np.array(list(zip(x, y)))

    if display:
        # plot heart shape
        fig, (ax1) = plt.subplots(ncols=1, figsize=(10, 4))
        ax1.set_aspect("equal")
        ax1.plot(x, y, "o", linewidth=2)
        plt.show()

    return points


def hypotrochoid_example(numpts=200, display=False):
    # parametric equation for heart shape
    # x = 16 sin^3(t)
    # y = 13 cos(t) - 5 cos(2t) - 2 cos(3t) - cos(4t)
    a = 1.66
    b = 0.33

    # parameters for sampling density
    t = np.linspace(0, 2 * np.pi, numpts)
    x = (a + b) * np.cos(t) + b * np.cos((a + b) * t / b)
    y = (a + b) * np.sin(t) + b * np.sin((a + b) * t / b)

    points = np.array(list(zip(x, y)))

    if display:
        # plot heart shape
        fig, (ax1) = plt.subplots(ncols=1, figsize=(10, 4))
        ax1.set_aspect("equal")
        ax1.plot(x, y, "-o", linewidth=2)
        plt.show()

    return points


def heart_example(numpts=200, display=False):
    # parametric equation for heart shape
    # x = 16 sin^3(t)
    # y = 13 cos(t) - 5 cos(2t) - 2 cos(3t) - cos(4t)

    # parameters for sampling density
    t = np.linspace(0, 2 * np.pi, numpts)
    x = 16 * np.power(np.sin(t), 3)
    y = 13 * np.cos(t) - 5 * np.cos(2 * t) - 2 * np.cos(3 * t) - np.cos(4 * t)
    points = np.array(list(zip(x, y)))

    if display:
        # plot heart shape
        fig, (ax1) = plt.subplots(ncols=1, figsize=(10, 4))
        ax1.set_aspect("equal")
        ax1.plot(x, y, "r", linewidth=2)
        plt.show()

    return points


def rose_example(numpts=200, display=False):
    # parametric equation for heart shape
    # x = 16 sin^3(t)
    # y = 13 cos(t) - 5 cos(2t) - 2 cos(3t) - cos(4t)

    # parameters for sampling density
    t = np.linspace(0, 2 * np.pi, numpts)
    x = np.cos(t) * np.sin(4 * t)
    y = np.sin(t) * np.sin(4 * t)
    points = np.array(list(zip(x, y)))

    if display:
        # plot heart shape
        fig, (ax1) = plt.subplots(ncols=1, figsize=(10, 4))
        ax1.set_aspect("equal")
        ax1.plot(x, y, "r", linewidth=2)
        plt.show()

    return points


def fermat_spiral(numpts=400, a=5, display=False):
    # parametric equation for Fermat's Spiral
    # r^2 = a^2 * theta
    # https://elepa.files.wordpress.com/2013/11/fifty-famous-curves.pdf
    # note to self: spiral of archimedes, number 42, is also good.

    # parameters for sampling density
    theta = np.linspace(0, 10 * np.pi, numpts)
    rpos = np.sqrt(a**2 * theta)
    rneg = -np.sqrt(a**2 * theta)
    flipx = np.flip((rpos * np.cos(theta)))
    flipy = np.flip((rpos * np.sin(theta)))
    x = np.concatenate((flipx, rneg * np.cos(theta)))
    y = np.concatenate((flipy, rneg * np.sin(theta)))
    points = np.array(list(zip(x, y)))

    if display:
        # plot Fermat's Spiral
        fig, (ax1) = plt.subplots(ncols=1, figsize=(10, 4))
        ax1.set_aspect("equal")
        ax1.plot(x, y, "r")
        plt.show()

    return points


def half_fermat_spiral(numpts=200, a=0.5, display=False):
    # parametric equation for Fermat's Spiral
    # r^2 = a^2 * theta

    # parameters for sampling density
    theta = np.linspace(0, 10 * np.pi, numpts)
    r = np.sqrt(a**2 * theta)
    x = r * np.cos(theta)
    y = r * np.sin(theta)
    points = np.array(list(zip(x, y)))

    if display:
        # plot Fermat's Spiral
        fig, (ax1) = plt.subplots(ncols=1, figsize=(10, 4))
        ax1.set_aspect("equal")
        ax1.plot(x, y, "r", linewidth=2)
        plt.show()

    return points