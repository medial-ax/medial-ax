from classes_loop import complex

from matplotlib import pyplot as plt
import numpy as np


def color_heat(f: float) -> tuple[float, float, float]:
    return (1 - 0.9 * f, 0.2, 0.2 * f)


def color_sunset(f: float) -> tuple[float, float, float]:
    lst = [
        (0.0, float(0x00) / 255, float(0x3F) / 255, float(0x5C) / 255),
        (0.2, float(0x37) / 255, float(0x4C) / 255, float(0x80) / 255),
        (0.4, float(0x7A) / 255, float(0x51) / 255, float(0x95) / 255),
        (0.6, float(0xEF) / 255, float(0x56) / 255, float(0x75) / 255),
        (0.8, float(0xFF) / 255, float(0x76) / 255, float(0x4A) / 255),
        (1.0, float(0xFF) / 255, float(0xA6) / 255, float(0x00) / 255),
    ]
    bucket = int(f // 0.2)
    # frac is percentage of way f is between 0 and 1
    frac = (f % 0.2) * 5
    bbucket = (bucket + 1) if bucket < len(lst) - 1 else bucket
    return (
        lst[bucket][1] * (1 - frac) + lst[bbucket][1] * frac,
        lst[bucket][2] * (1 - frac) + lst[bbucket][2] * frac,
        lst[bucket][3] * (1 - frac) + lst[bbucket][3] * frac,
    )


def plot_complex(
    complex: complex,
    extras=True,
    label_edges=False,
    label_verts=True,
    sp_pt_color="red",
    filename=None,
):
    points = np.array([v.coords for v in complex.vertlist])

    x = points[:, 0].flatten()
    y = points[:, 1].flatten()

    dists = [v.radialdist for v in complex.vertlist]
    maxx = max(dists)

    for edge in complex.edgelist:
        # percentage = dists[edge.boundary[0]] / maxx
        percentage = edge.columnvalue / (complex.nedges() + complex.nverts())
        smartcolor = color_sunset(1 - percentage)

        point1 = complex.vertlist[edge.boundary[0]].coords
        point2 = complex.vertlist[edge.boundary[1]].coords

        plt.plot(
            [point1[0], point2[0]],
            [point1[1], point2[1]],
            color=smartcolor,
            linewidth=3,
        )

        # label edges for debugging
        if label_edges or False:
            # label edge
            avg_x = (point1[0] + point2[0]) / 2
            avg_y = (point1[1] + point2[1]) / 2
            plt.text(
                avg_x,
                avg_y,
                "e" + str(edge.index),
                fontsize=12,
                # bbox=dict(facecolor="white", alpha=0.75, edgecolor="white"),
            )
            if extras:
                shift = 0.4
                plt.text(
                    avg_x,
                    avg_y + shift,
                    "e" + str(edge.orderedindex),
                    fontsize=12,
                    # bbox=dict(facecolor="red", alpha=0.75, edgecolor="white"),
                )
                shift2 = -0.4
                plt.text(
                    avg_x,
                    avg_y + shift2,
                    "c" + str(edge.columnvalue),
                    fontsize=12,
                    color="white",
                    # bbox=dict(facecolor="blue", alpha=0.75, edgecolor="white"),
                )

        plt.plot(*point1, color=smartcolor, marker="o", markersize=4)
        # add labels to points
        # white, sampling index
        if label_verts and False:
            offset2 = 0.0
            plt.text(
                x[i] + offset2,
                y[i] + offset2,
                str(complex.vertlist[i].index),
                fontsize=12,
                color="black",
                # bbox=dict(facecolor="white", alpha=0.75, edgecolor="white"),
            )

        if extras and False:
            # blue, column assignment
            offset3 = -0.9
            plt.text(
                x[i] + offset3,
                y[i],
                "c" + str(complex.vertlist[i].columnvalue),
                fontsize=12,
                color="white",
                # bbox=dict(facecolor="blue", alpha=0.75, edgecolor="black"),
            )
            # red, dist from pt
            # offset makes the label not sit on the point exactly
            offset = 0.6
            plt.text(
                x[i] + offset,
                y[i],
                str(complex.vertlist[i].orderedindex),
                fontsize=12,
                # bbox=dict(facecolor="red", alpha=0.75, edgecolor="white"),
            )

    # plot key point (we calculate dist from this)
    plt.plot(
        complex.key_point[0],
        complex.key_point[1],
        color="black",
        marker="o",
        markersize=8,
    )
    plt.plot(
        complex.key_point[0],
        complex.key_point[1],
        color="red",
        marker="o",
        markersize=6,
    )

    plt.axis("equal")
    plt.grid(True)
    if filename:
        plt.savefig(filename, dpi=300)
    return plt
