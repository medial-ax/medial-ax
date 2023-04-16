import numpy as np
from scipy.spatial import distance
# visualization
from scipy.spatial import Voronoi, voronoi_plot_2d
import matplotlib.pyplot as plt
import matplotlib as mpl
from matplotlib.colors import ListedColormap, LinearSegmentedColormap

# these are imports for matrix handling and display
import pandas as pd
from copy import deepcopy
from IPython.display import display_html  # this is needed to display pretty matrices side by side
import time 

# for poly grid
from matplotlib.path import Path as mplPath

def ellipse_example(numpts = 7, display = False):
  # parametric eq for ellipse: 
  # $F(t) = (x(t), y(t))$, where $x(t) = a*cos(t)$ and $y(t) = b*sin(t)$

  # parameters for ellipse shape and sampling density
  a = 5
  b = 2

  # c is number of points
  c = numpts
  t = np.arange(0.0, 6.28, 6.28/c)
  if display:
    fig, (ax1, ax2) = plt.subplots(1,2, sharey = True)
  x = a*np.cos(t)
  y = b*np.sin(t)
  points = np.array(list(zip(x,y)))
  vor = Voronoi(points)

  if display:
    # plot ellipse
    num = 10
    ax1.set_xlim(-(max(a,b) + num), (max(a,b) + num))
    ax1.set_ylim(-(max(a,b) + num), (max(a,b) + num))
    ax1.set_aspect('equal')
    ax1.plot(x,y,'o')

    # plot voronoi stuff
    ax2.set_xlim(-(max(a,b) + 1), (max(a,b) + 1))
    ax2.set_ylim(-(max(a,b) + 1), (max(a,b) + 1))
    ax2.set_aspect('equal')
    voronoi_plot_2d(vor, ax2, show_vertices=True, line_alpha = 0, show_points = True, point_colors='orange', point_size=10)

    fig.set_figwidth(30)
    fig.set_figheight(30)
    plt.show()
  return points

def rectangle_example(numpts=4, display=False):
    # note: this goes in cw order, hopefully not an issue
    # parameters for rectangle shape and sampling density
    width = 8
    height = 4
    
    # calculate points on the boundary of the rectangle
    x1 = np.linspace(-width/2, width/2, num=numpts//4+1)[:-1]
    y1 = np.full_like(x1, height/2)
    
    x2 = np.full_like(y1, width/2)
    y2 = np.linspace(height/2, -height/2, num=numpts//4+1)[:-1]
    
    x3 = np.linspace(width/2, -width/2, num=numpts//4+1)[:-1]
    y3 = np.full_like(x3, -height/2)
    
    x4 = np.full_like(y3, -width/2)
    y4 = np.linspace(-height/2, height/2, num=numpts//4+1)[:-1]
    
    x = np.concatenate([x1, x2, x3, x4])
    y = np.concatenate([y1, y2, y3, y4])
    points = np.array(list(zip(x, y)))

    if display:
        # plot rectangle
        fig, ax1 = plt.subplots(figsize=(10, 4))
        ax1.set_xlim(-width/2-1, width/2+1)
        ax1.set_ylim(-height/2-1, height/2+1)
        ax1.set_aspect("equal")
        ax1.plot(x, y, 'o', linewidth=2)
        plt.show()

    return points

def epicycloid_example(numpts=200, display=False):
  # parametric equation for heart shape
  # x = 16 sin^3(t)
  # y = 13 cos(t) - 5 cos(2t) - 2 cos(3t) - cos(4t)

  # parameters for sampling density
  t = np.linspace(0, 2*np.pi, numpts)
  x = 4*np.cos(t) - np.cos(4*t)
  y = 4*np.sin(t) - np.sin(4*t)
  points = np.array(list(zip(x,y)))

  if display:
    # plot heart shape
    fig, (ax1) = plt.subplots(ncols=1, figsize=(10, 4))
    ax1.set_aspect("equal")
    ax1.plot(x, y, 'o', linewidth=2)
    plt.show()

  return points

def heart_example(numpts=200, display=False):
  # parametric equation for heart shape
  # x = 16 sin^3(t)
  # y = 13 cos(t) - 5 cos(2t) - 2 cos(3t) - cos(4t)

  # parameters for sampling density
  t = np.linspace(0, 2*np.pi, numpts)
  x = 16 * np.power(np.sin(t), 3)
  y = 13 * np.cos(t) - 5 * np.cos(2*t) - 2 * np.cos(3*t) - np.cos(4*t)
  points = np.array(list(zip(x,y)))

  if display:
    # plot heart shape
    fig, (ax1) = plt.subplots(ncols=1, figsize=(10, 4))
    ax1.set_aspect("equal")
    ax1.plot(x, y, 'r', linewidth=2)
    plt.show()

  return points

def rose_example(numpts=200, display=False):
  # parametric equation for heart shape
  # x = 16 sin^3(t)
  # y = 13 cos(t) - 5 cos(2t) - 2 cos(3t) - cos(4t)

  # parameters for sampling density
  t = np.linspace(0, 2*np.pi, numpts)
  x = np.cos(t)*np.sin(4*t)
  y = np.sin(t)*np.sin(4*t)
  points = np.array(list(zip(x,y)))

  if display:
    # plot heart shape
    fig, (ax1) = plt.subplots(ncols=1, figsize=(10, 4))
    ax1.set_aspect("equal")
    ax1.plot(x, y, 'r', linewidth=2)
    plt.show()

  return points

def fermat_spiral(numpts= 400, a=5, display=False):
    # parametric equation for Fermat's Spiral
    # r^2 = a^2 * theta
    # https://elepa.files.wordpress.com/2013/11/fifty-famous-curves.pdf
    # note to self: spiral of archimedes, number 42, is also good.

    # parameters for sampling density
    theta = np.linspace(0, 10*np.pi, numpts)
    rpos = np.sqrt(a**2 * theta)
    rneg = -np.sqrt(a**2 * theta)
    flipx = np.flip((rpos * np.cos(theta)))
    flipy = np.flip((rpos * np.sin(theta)))
    x = np.concatenate((flipx, rneg * np.cos(theta)))
    y = np.concatenate((flipy, rneg * np.sin(theta)))
    points = np.array(list(zip(x,y)))

    if display:
        # plot Fermat's Spiral
        fig, (ax1) = plt.subplots(ncols=1, figsize=(10, 4))
        ax1.set_aspect("equal")
        ax1.plot(x, y, 'r')
        plt.show()

    return points

def half_fermat_spiral(numpts=200, a=0.5, display=False):
  # parametric equation for Fermat's Spiral
  # r^2 = a^2 * theta

  # parameters for sampling density
  theta = np.linspace(0, 10*np.pi, numpts)
  r = np.sqrt(a**2 * theta)
  x = r * np.cos(theta)
  y = r * np.sin(theta)
  points = np.array(list(zip(x,y)))

  if display:
    # plot Fermat's Spiral
    fig, (ax1) = plt.subplots(ncols=1, figsize=(10, 4))
    ax1.set_aspect("equal")
    ax1.plot(x, y, 'r', linewidth=2)
    plt.show()

  return points


def points_inside_polygon(vertices, cell_size, x_bump = 0, y_bump = 0):
    # Compute bounding box of polygon
    x_min, y_min = np.min(vertices, axis=0)
    x_max, y_max = np.max(vertices, axis=0)

    # Compute grid shape and origin
    x_range = np.arange(x_min + x_bump, x_max + x_bump + cell_size, cell_size)
    y_range = np.arange(y_min + y_bump, y_max + y_bump + cell_size, cell_size)

    # Generate grid points
    xv, yv = np.meshgrid(x_range, y_range)
    points = np.column_stack([xv.ravel(), yv.ravel()])

    # Determine if each point is inside polygon
    path = mplPath(vertices)
    inside = path.contains_points(points)

    return points, inside, x_range, y_range

def polygon_grid(vertices, cell_size, x_bump = 0, y_bump = 0, plot = True):
    # Compute vertices inside polygons
    points, inside, x_range, y_range = points_inside_polygon(vertices, cell_size, x_bump = x_bump, y_bump = y_bump)
    
    if plot:
        # Plot polygons and grid points
        fig, (ax1) = plt.subplots(ncols=1, figsize=(10, 4))
        ax1.fill(vertices[:, 0], vertices[:, 1], color="#ccc")

        ax1.plot(points[inside, 0], points[inside, 1], "o", color="black")
        # plot the outside points
        ax1.plot(points[~inside, 0], points[~inside, 1], "x", color="red")

        ax1.set_title("Polygon Grid")
        ax1.set_aspect("equal")

        plt.show()
    return points, inside, x_range, y_range

def plot_nbrs(i, points, inside, x_range, y_range):
    fig, (ax1) = plt.subplots(ncols=1, figsize=(10, 4))
    ax1.set_aspect("equal")
    ax1.plot(points[inside, 0], points[inside, 1], "o", color="black")
    ax1.plot(points[~inside, 0], points[~inside, 1], "x", color="red")
    # length and width of grid
    # print(len(x_range), len(y_range))
    # center point
    if inside[i]:
        ax1.plot(points[i,0], points[i,1], 'o', color = 'red', markersize = 10)
    else:
        ax1.plot(points[i,0], points[i,1], 'x', color = 'red', markersize = 10)
    
    # right neighbor
    r = i + 1
    # left neighbor
    l = i - 1
    # upstairs neighbor
    up = i + len(x_range)
    # downstairs neighbor
    down = i - len(x_range)

    # case one: bottom row: no bottom neighbor
    if i in range(0, len(x_range)):
        down = None
        
    # case two: right column
    if (i + 1) % len(x_range) == 0 and i != 0:
        r = None

    # case three: left column
    if i % len(x_range) == 0:
        l = None

    # case four: top row
    xx = len(x_range)
    yy = len(y_range)
    if i in range(xx*(yy - 1), xx*yy):
        up = None

    # case five: we're in the interior and life is good

    # right neighbor
    if r != None and inside[i] and inside[i + 1]:
        ax1.plot(points[r,0], points[i,1], 'o', color = 'black', markersize = 10)
        ax1.plot(points[r,0], points[i,1], 'o', color = 'yellow', markersize = 8)
    # left neighbor
    if l != None and inside[i] and inside[i - 1]: 
        ax1.plot(points[l,0], points[i,1], 'o', color = 'black', markersize = 10)
        ax1.plot(points[l,0], points[i,1], 'o', color = 'yellow', markersize = 8)
    # upstairs neighbor
    if up != None and inside[i] and inside[i + len(x_range)]:
        ax1.plot(points[i,0], points[up,1], 'o', color = 'black', markersize = 10)
        ax1.plot(points[i,0], points[up,1], 'o', color = 'yellow', markersize = 8)
    # downstairs neighbor
    if down != None and inside[i] and inside[i - len(x_range)]:
        ax1.plot(points[i,0], points[down,1], 'o', color = 'black', markersize = 10  )
        ax1.plot(points[i,0], points[down,1], 'o', color = 'yellow', markersize = 8)

    plt.show()

def find_neighbors(i, inside, x_range, y_range):
    neighbors = []
    # right neighbor
    r = i + 1
    # left neighbor
    l = i - 1
    # upstairs neighbor
    up = i + len(x_range)
    # downstairs neighbor
    down = i - len(x_range)

    # case one: bottom row: no bottom neighbor
    if i in range(0, len(x_range)):
        down = None

    # finish error checking this
    # case two: right column
    if (i + 1) % len(x_range) == 0 and i != 0:
        r = None

    # case three: left column
    if i % len(x_range) == 0:
        l = None

    # case four: top row
    xx = len(x_range)
    yy = len(y_range)
    if i in range(xx*(yy - 1), xx*yy):
        up = None

    # case five: we're in the interior and life is good

    # right neighbor
    if r != None and inside[i] and inside[i + 1]:
        neighbors.append(r)
    # left neighbor
    if l != None and inside[i] and inside[i - 1]: 
        neighbors.append(l)
    # upstairs neighbor
    if up != None and inside[i] and inside[i + len(x_range)]:
        neighbors.append(up)
    # downstairs neighbor
    if down != None and inside[i] and inside[i - len(x_range)]:
        neighbors.append(down)
    return neighbors

    # print(" l",l,"\n",
    #       "r",r,"\n",
    #       "up",up,"\n",
    #       "down",down)
#     fig.savefig('output/' + str(i) +'.png')
#     plt.close()
    return 

def neighb_pairs(points, inside, x_range, y_range):
    # each row in neighbs is two special points to check knees between 
    neighbs = []
    for i in range(len(points)):
        if inside[i]:
            tempneighbs = find_neighbors(i, inside, x_range, y_range)
            for j in range(len(tempneighbs)):
                neighbs.append([points[i], points[tempneighbs[j]]])
    return neighbs

def kneebetween(point1, point2, inputpts, kneedim, vin, n = 20, i = 0, 
  j = 1, eps = 1, plot = False, printout = False):
    # kneedim is 0 or 1 for corresponding type of knee
    # use 0 for standard med ax, 1 for generalized


    objectt = inputpts

    # add complexes
    vin.add_complex(objectt, 
                    point1, show_details = False, timethings = False, 
                    zoomzoomreduce = True)
    vin.add_complex(objectt, 
                    point2, show_details = False, timethings = False, 
                    zoomzoomreduce = True)
    # plot
    if plot: 
        vin.complexlist[i].plot(extras = False, label_edges = False, 
                                label_verts = False, sp_pt_color = 'black', timethings = True)
        vin.complexlist[j].plot(extras = False, label_edges = False, 
                                label_verts = False, sp_pt_color = 'black', timethings = True)

    # the ints we input here are the complexes in order in vin, in the list complexlist
    # returns: is_emptyset_knee, is_zero_knee, epsilon
    
    knee_tf = vin.is_knee(i, j, eps, printout = printout)
    return knee_tf[kneedim], objectt

def make_medial_axis(numpts, epsilon, grid_density, inputpts, 
                     design = 'ellipse', axis = 0, drawgrid = False,
                     savefig = True, figsavename = 'test.png',
                     x_bump = 0, y_bump = 0, plotpoints = True):

    # points is gridpoints locations
    points, inside, x_range, y_range = \
    polygon_grid(inputpts, grid_density, x_bump = x_bump, 
      y_bump = y_bump, plot = drawgrid);


    # each row in neighbs is two special points to check knees between 
    neighbs = neighb_pairs(points, inside, x_range, y_range)


    fig, (ax1) = plt.subplots(ncols=1, figsize=(10, 4))
    ax1.set_aspect("equal")

    ax1.plot(inputpts[:,0], inputpts[:,1], "o", color = "lightblue", markersize = 15)
    if drawgrid:
      ax1.plot(points[inside, 0], points[inside, 1], "x", color="black")
      ax1.plot(points[~inside, 0], points[~inside, 1], "x", color="gray")


    # Plot the line segments between the points
    for i in range(len(inputpts)-1):
        ax1.plot([inputpts[i][0], inputpts[i+1][0]], [inputpts[i][1], inputpts[i+1][1]], color='black')

    # Plot the last line segment to connect the last and first points
    ax1.plot([inputpts[-1][0], inputpts[0][0]], [inputpts[-1][1], inputpts[0][1]], color='black')


    # need to be able to set grid density here
    # obviously vineyards need to be init out here, this is ridiculous

    for i in range(len(neighbs)):
        vin = vineyard()
        # re init these just to make sure we can run this multiple times
        vin.pointset = np.empty(2)
        vin.complexlist = []
        vin.matrixlist = []
        vin.keypointlist = []

        point1 = neighbs[i][0]
        point2 = neighbs[i][1]
        # point1, point2, kneedim, vin, n = 20, i = 0, j = 1, 
        # eps = 1, plot = False, printout = False
        # note: i and j refer to the two positions on the stack of vineyards. 0 and 1 if we reinitialize. 
        if kneebetween(point1, point2, inputpts, axis, vin, n = numpts, i = 0, j = 1, eps = epsilon)[0]:
            if plotpoints:
              ax1.plot((point1[0] + point2[0])/2, (point1[1] + point2[1])/2, 
                       "o", color = "red",markersize = 10)

            # we also want to plot the line between the grid cells
            # Calculate the midpoint of the line segment connecting the two vertices
            midpoint = (point1 + point2) / 2

            # Calculate the vector pointing from point1 to point2
            vector = point2 - point1

            # Calculate the perpendicular vector by swapping the x and y coordinates and negating one of them
            perp_vector = np.array([-vector[1], vector[0]])

            # Calculate the coordinates of the other two vertices by adding and subtracting the perpendicular vector from the midpoint
            point3 = midpoint + perp_vector / 2
            point4 = midpoint - perp_vector / 2

            # plot the line
            ax1.plot([point3[0], point4[0]], [point3[1], point4[1]], color='red')
    plt.text(5, -20, design + f"\nn: {numpts} \neps: {epsilon} \ngrid: {grid_density}", 
             fontsize = 12, bbox = dict(facecolor='white', alpha=0.75, edgecolor = 'white'))
    if savefig:
        plt.savefig('../shapes_medax/' + figsavename, dpi = 300, pad_inches = 1)
    plt.show()

def array2sparse(matrix):
#     we're going to make a better repr of a matrix. 
#     we'll have a dictionary, like this:
#     d = {
#     c : {r1, r2, r3},
#     }
#     where column:row indicates the location of a 1 in the matrix.
#     this way we don't store zeros, and computation will be faster. 
    sparseboii = {}
    height = len(matrix[:][0])
    width = len(matrix[0][:])
    for col_j in range(width):
        for row_i in range(height):
            if matrix[row_i][col_j] == 1:
                if col_j not in sparseboii.keys():
                    # initialize set 
                    sparseboii[col_j] = set()
                sparseboii[col_j].add(row_i)
    return sparseboii

def findlowestone(sparsemat, col_num):
    # a fast way to find the lowest one 
    # in a column in a sparse dict repr of
    # a boundary matrix
    # returns row num of lowest one
    if len(sparsemat[col_num]) == 0:
      return None
    else:
      return max(sparsemat[col_num])

def sparse2array(sparse, n):
    # n can be either height or width 
    # by construction we only have square matrices
    matrix = np.zeros((n,n), dtype=int)
    for col_j in range(n):
        if col_j in sparse.keys():
            for row_i in sparse[col_j]:
                matrix[row_i][col_j] = 1
    return matrix

class simplex: 
  def __init__(self):
    # here we initialize everything. if defining an attribute with a function, must init func first.
    self.coords = []
    self.boundary = []
    self.index = -1
    self.orderedindex = -1
    # column value is a bit redundant; would be better to only have orderedindex. 
    # we do this now because of not knowing how to do things properly. 
    # later it would be good to merge columnvalue with orderedindex.

    # NOTE: columnvalue is not in reduced notation! in the actual matrix, 
    # add 1 because of the dummy column.
    self.columnvalue = -1
    # index is an int value that is the ordering of the simp
    self.dim = -1
    # this is redundant
    self.radialdist = -1.0
    self.parents = []


  def __repr__(self):
      # IN PROGRESS
      # f strings are easy way to turn things into strings
      return f'\nsimplex ind {self.index}, dim {self.dim}, bd {self.boundary}, ord ind {self.orderedindex}, col val {self.columnvalue}'
      # usage: print(rect), where rect is a Rectangle
       

class complex:
  def __init__(self):
    # seems like it's fine to have lists as long as they're not parameters of the class
    # otherwise, they're shared by the whole class and that is no
    self.edgelist = []
    self.vertlist = []
    self.key_point = [0.0, 0.0]

  def __repr__(self):
    # IN PROGRESS
    # f strings are easy way to turn things into strings
    return f'number of verts is {self.nverts()}, and number of edges is {self.nedges()}'
    # usage: print(rect), where rect is a Rectangle

  def plot(self, extras = True, label_edges = False, label_verts = True, sp_pt_color = 'red', timethings = False):
    if timethings:
      start_time = time.perf_counter() 

    points = np.array([v.coords for v in self.vertlist])
    # edges are repr as indices into points
    edges = np.array([e.boundary for e in self.edgelist])
    
    x = points[:,0].flatten()
    y = points[:,1].flatten()

    dists = [v.radialdist for v in self.vertlist]
    maxx = max(dists)
    # print(dists)
    inds = [v.index for v in self.vertlist]
    # print(dists)

    # for i in range(len(x)):
    for i in range(len(self.vertlist)):

      #smartcolor = (1 - .8*(dists[i])/max(dists), .2, .2)
      # change this so for i in 0 to len(x), it uses 1 - i*10%len(x)
      #percentage = int(10*i/len(x))/10
      percentage = np.floor(10*dists[i]/maxx)/10
      #print(percentage)
      smartcolor = (1 - .9*percentage, .2, .2*percentage)
      #print(smartcolor)

      # plot edges with smart color assignment: 
      point1 = [x[i], y[i]]
      point2 = [x[(i + 1)%len(x)], y[(i + 1)%len(x)]]  
      x_values = [point1[0], point2[0]]
      y_values = [point1[1], point2[1]]
      plt.plot(x_values, y_values, color = smartcolor, linewidth = 8)

      # label edges for debugging
      if label_edges:
        # label edge
        avg_x = (point1[0] + point2[0])/2
        avg_y = (point1[1] + point2[1])/2
        plt.text(avg_x, avg_y, 'e' + str(self.edgelist[i].index), fontsize = 12, \
          bbox = dict(facecolor='white', alpha=0.75, edgecolor = 'white'))
        if extras:
          shift = 0.4
          plt.text(avg_x, avg_y + shift, 'e' + str(self.edgelist[i].orderedindex), 
            fontsize = 12, \
            bbox = dict(facecolor='red', alpha=0.75, edgecolor = 'white'))
          shift2 = -0.4
          plt.text(avg_x, avg_y + shift2, 'c' + str(self.edgelist[i].columnvalue), 
            fontsize = 12, color = 'white', \
            bbox = dict(facecolor='blue', alpha=0.75, edgecolor = 'white'))

      plt.plot(x[i], y[i], color = smartcolor, marker='o', markersize = 15) 
      # add labels to points
      # white, sampling index
      if label_verts:
        offset2 = 0.0
        plt.text(x[i] + offset2, y[i] + offset2, str(self.vertlist[i].index), 
          fontsize = 12, color = 'black', bbox = dict(facecolor='white', alpha=0.75, 
            edgecolor = 'white'))

      if extras:
        # blue, column assignment
        offset3 = -0.9
        plt.text(x[i] + offset3, y[i], 'c' + str(self.vertlist[i].columnvalue),
         fontsize = 12, color = 'white', bbox = dict(facecolor='blue', alpha=0.75, 
          edgecolor = 'black'))
        # red, dist from pt
        # offset makes the label not sit on the point exactly
        offset = 0.6
        plt.text(x[i] + offset, y[i], str(self.vertlist[i].orderedindex), fontsize = 12, 
          bbox = dict(facecolor='red', alpha=0.75, edgecolor = 'white'))

    # plot key point (we calculate dist from this)
    plt.plot(self.key_point[0], self.key_point[1], color = sp_pt_color, marker = 'o', 
      markersize = 10)
    # plot horizontal guide line
    plt.plot([-5,5], [0,0], color = 'black', linewidth = 2)
    # plot vertical guide line
    plt.plot([0,0], [2,-2], color = 'black', linewidth = 2)
    plt.axis('equal')
    if timethings:
        plt.text(6, -3, f"plotting took {time.perf_counter() - start_time :.3f} sec", 
          fontsize = 12, 
          bbox = dict(facecolor='white', alpha=0.75, edgecolor = 'white'))
    plt.show()
    
  def order_all_simps(self):
    all_simplices = self.vertlist + self.edgelist
    simplex_key = lambda simplex: (simplex.orderedindex, len(simplex.boundary), simplex.index)
    all_simplices.sort(key=simplex_key)

    for i in range(len(all_simplices)):
        all_simplices[i].columnvalue = i + 1
    return all_simplices

  def print_inds(self):
    print(self.nverts, " indices")
    for i in range(self.nverts()):
      print("orig ", self.vertlist[i].index, " new: ", self.vertlist[i].orderedindex)
  
  def nedges(self):
    return len(self.edgelist)

  def nverts(self):
    return len(self.vertlist)

  def init_verts(self, points):
    i = 0
    for point in points:
      temp_simplex = simplex()
      temp_simplex.coords = [round(point[0],2), round(point[1],2)]
      temp_simplex.index = i
      temp_simplex.dim = 0
      temp_simplex.boundary = [-1]
      i += 1
      self.vertlist.append(temp_simplex)

  def init_edges(self):
    for i in range(len(self.vertlist)):
        temp_edge = simplex()
        temp_edge.boundary = [i, (i + 1)%(len(self.vertlist))]
        temp_edge.dim = 1
        # temp_edge.index = i + 1 # maybe this makes no sense
        temp_edge.index = i  # maybe this makes no sense
        self.edgelist.append(temp_edge)
        i += 1

  def find_sq_dist(self, init_complex):
    distlist = []
    # find distance-squareds
    for i in range(len(init_complex.vertlist)):
        temp_simplex = init_complex.vertlist[i]
        dist = distance.euclidean(self.key_point, temp_simplex.coords)
        distsq = round(dist*dist,2)
        temp_simplex.radialdist = distsq
        distlist.append(distsq)
        # reset the index
        temp_simplex.index = i
        self.vertlist.append(temp_simplex)
        i += 1
    return distlist

  def sort_inds(self, distlist):
    # sorts by distlist[ind] but in case of tie, ind breaks tie
    # "" sorts by radius, but then uses input index to consistently break ties
    old_indices = []
    for i in range(len(self.vertlist)):
        old_indices.append(self.vertlist[i].index)  
    for new_i, i in enumerate(sorted(old_indices, key = lambda ind: (distlist[ind], ind))):
        self.vertlist[i].orderedindex = new_i

  def sort_edges(self):
    self.edgelist = []
    for vert in self.vertlist: 
        vert.parents = []

    for i in range(len(self.vertlist)):
        temp_edge = simplex()
        j = (i + 1)%(len(self.vertlist))
        # i is the first vert in the edge, and j is the second. 
        # this assumes we are dealing with a closed loop, in which case
        # the final vertex is the 0th vert.
        
        #NOTE: the boundary should be actual simplices, not just ints
        temp_edge.boundary = [i, j]
        temp_edge.dim = 1
        temp_edge.index = i # maybe this makes no sense
        temp_edge.coords = [[self.vertlist[i].coords],[self.vertlist[j].coords]]
        
        # here the index of the edges is NOT unique over all simplices, because it's just in the for loop, so
        # we can't tell the difference between an edge and a vertex by just the index
        self.vertlist[i].parents.append(i)
        self.vertlist[j].parents.append(i)
        temp_edge.orderedindex = max(self.vertlist[i].orderedindex, self.vertlist[j].orderedindex )
        self.edgelist.append(temp_edge)
        i += 1

def initcomplex(points):
  init_complex = complex()
  init_complex.init_verts(points)
  init_complex.init_edges()
  return init_complex

def sort_complex(s_complex, distlist, plot = True):
  # distlist = s_complex.find_sq_dist(init_complex)
  s_complex.sort_inds(distlist)
  s_complex.sort_edges()
  if plot:
    s_complex.plot(extras = False)

class bdmatrix: 
  def __init__(self):
    self.temp = "temp"
    self.initmatrix = np.array([\
         [0,1,0,0,0,0,0,0],\
         [0,1,1,0,0,0,0,0],\
         [0,0,1,1,0,0,0,0],\
         [0,0,0,1,1,0,0,0],\
         [0,0,0,0,1,1,0,0],\
         [0,0,0,0,0,1,1,0],\
         [0,0,0,0,0,0,1,1],\
         [0,0,0,0,0,0,0,0]])
    self.redmatrix = np.array([\
         [0,0,0,0,0,0,0,0],\
         [0,0,0,0,0,0,0,0],\
         [0,0,0,0,0,0,0,0],\
         [0,0,0,0,0,0,0,0],\
         [0,0,0,0,0,0,0,0],\
         [0,0,0,0,0,0,0,0],\
         [0,0,0,0,0,0,0,0],\
         [0,0,0,0,0,0,0,0]])
    self.display_reduction = True
    # here, index refers as usual to the very initial index a simplex has
    # dim is the dim of column simplex, as in index
    # dim for lows is ROW DIM
    self.lowestones = {
        "col" : [],
        "row" : [],
        "dim" : [],
        "col_index" : [],
        "row_index" : []    
    }

    # dim here is COL DIM
    self.zerocolumns = {
        "col" : [],
        "dim" : [],
        "col_index" : []  
    }
    self.bd_pairs = {
        # initial index. we can't differentiate vert/edge this way,
        # but we can by knowing classdim, so it's fine.
        "birth": [],
        "death": [],
        # always the dim of the 
        # birth simplex. 
        # the death simplex has dim +1 from birth. 
        # ISSUE
        # does it actually?! !!!
        # I think that a vert could be paired with a triangle
        "classdim": [],
        "b_simplex": [],
        "d_simplex": []
    }
    self.unpaired = {
        # classdim is the same as dim of birth simplex.
        # this is needed also so we know if it's a vert or edge,
        # since the index alone doesn't tell us.
        "birth": [],
        "classdim": [],
        "b_simplex": []
    }


  def __repr__(self):
    # IN PROGRESS
    # f strings are easy way to turn things into strings
    return f'this is a matrix.'

  def highlight_cells(val):
    color = '#FFC6c4' if val == 1 else ''
    style='display:inline'
    return 'background-color: {}'.format(color)

  def highlight_cells_2(val):
      color = '#FFC666' if val == 0 else ''
      style = 'display:inline'
      return 'background-color: {}'.format(color)
   

  def lowest_one(matrix_column):
      # go from bottom to top of column and return first 1 encountered
      # usage example: matrix[:,0] returns the 0th column
      column = np.array(matrix_column)
      length = column.size
      for i in range(length):
          if column[length - i - 1] == 1:
            # this probably needs to go to outside of for loop because I'm returning a bunch of ones
              return length - i - 1
      return None

  def make_matrix(self, orderedcplx):
    n = len(orderedcplx.vertlist) + len(orderedcplx.edgelist) + 1
    orderedmat = np.zeros((n,n), dtype=int)

    # give all verts columns a 1 at position 0 because of empty simplex
    for i in range(len(orderedcplx.vertlist)):
        # column (orderedcplx.vertlist[i].columnvalue), row 0, gets a 1
        orderedmat[0][orderedcplx.vertlist[i].columnvalue] = 1
        
    # next, go over edges
    for i in range(len(orderedcplx.edgelist)):
        # column (orderedcplx.edgelist[i].columnvalue), row j, gets a 1 if 
        # orderedcplx.edgelist[i].boundary contains j
        index_k = orderedcplx.edgelist[i].boundary[0]
        index_m = orderedcplx.edgelist[i].boundary[1]
        # now need to find row containing index k,m. 
        # it is of form simplx.columnvalue = k
        # need to find simplex.columnvalue s.t. simplex.index = k
        for x in orderedcplx.vertlist:
            if x.index == index_k:
                orderedmat[x.columnvalue][orderedcplx.edgelist[i].columnvalue] = 1
                break
        else:
            x = None
        for x in orderedcplx.vertlist:
            if x.index == index_m:
                orderedmat[x.columnvalue][orderedcplx.edgelist[i].columnvalue] = 1
                break
        else:
            x = None
    self.initmatrix = orderedmat

  def smartreduce(self):
    # array2sparse is at top of file
    sparsemat = array2sparse(self.initmatrix)
    #print(sparsemat)

    # from monster book:
    # j is column 
    # for j = 1 to m do:
    #    while there exists j0 < j s.t. low(j0) = low(j) do: 
    #      add column j0 to column j
    #    end while
    # end for

    # note: it's a square matrix by construction. 
    number_of_cols = len(self.initmatrix[:][0])
    # j is an index, but we use it as a key
    for j in range(number_of_cols):
      if j in sparsemat.keys():
        # while there is col_j0 left of col_j with low(j0) = low(j)
        # add col j0 to col j 
        while True:
            should_restart = False
            for j0 in range(j):
                if j0 in sparsemat.keys():
                    if findlowestone(sparsemat, j0) == findlowestone(sparsemat, j) \
                    and findlowestone(sparsemat, j0) != None:
                        sparsemat[j] = sparsemat[j] ^ sparsemat[j0]
                        # restart the while loop
                        should_restart = True
                        break
            if should_restart:
                continue
            else:
                break 

    # get rid of empty cols
    for j in range(number_of_cols):
      if j in sparsemat.keys():
        if len(sparsemat[j]) == 0:
          sparsemat.pop(j)
    #print("\n", sparsemat)
    backtomat = sparse2array(sparsemat, len(self.initmatrix[:][0]))
      
    # NEXT: ondra's sneaky trick to speed up by an order of n: 
    # reduce by dimension first (higher to lower), and L-R within
    # dimension. This takes it from n^4 to n^3 in expectation.
    return backtomat
    

  def reduce(self, display = True):
      # why do we deepcopy here?
      # sometimes deepcopy is slow, see if it's faster to copy by hand
      matrix = deepcopy(self.initmatrix)
      dfstyles = []
      # print("columns: ", matrix[0,:].size, " rows: ", matrix[:,0].size)
      cell_hover = {  # for row hover use <tr> instead of <td>
          'selector': 'td:hover',
          'props': [('background-color', '#ffffb3')]
      }

      # ondra made me add the tabs
      stylestring = pd.DataFrame(matrix).style.\
        applymap(bdmatrix.highlight_cells).\
        set_table_styles([cell_hover], 'columns').\
        set_table_attributes("style='display:inline'").\
        set_caption('Initial matrix')._repr_html_()
      
      # for each column i 
      for i in range(matrix[0,:].size):
          col_i = matrix[:,i]
          # For each column j left of column i, if low(j) = low(i), add j to i
          # this needs to be a while loop bc one of the ops could add a 1 back in

          # from monster book:
          # j is column 
          # for j = 1 to m do:
          #    while there exists j0 < j s.t. low(j0) = low(j) do: 
          #      add column j0 to column j
          #    end while
          # end for

          # col_i is what I call j from monsterbook
          # col_j is what I call j0 from monsterbook
          while True:
              should_restart = False
              for j in range(i):
                  col_j = matrix[:,j]
                  # print out lowest ones for debugging here
                  if (bdmatrix.lowest_one(col_j) == bdmatrix.lowest_one(col_i)) and (bdmatrix.lowest_one(col_j) != None):
                      # print("lowest one in col ", j,
                      #   "equals lowest one in col",i)
                      matrix[:,i] = (col_j + col_i) % 2

                      df_styler = pd.DataFrame(matrix).style.\
                        applymap(bdmatrix.highlight_cells).\
                        set_table_styles([cell_hover], 'columns').\
                        set_table_attributes("style='display:inline'").\
                        set_caption('column ' + str(j) + ' added to column ' + str(i) )._repr_html_()

                      dfstyles.append(df_styler)
                      # restart the while loop
                      should_restart = True
                      break
              if should_restart:
                  continue
              else:
                  break
      if display:
        for style in dfstyles: 
            stylestring = stylestring + style
        display_html(stylestring, raw=True)
      return matrix

  def add_dummy_col(self):
    # initializing here because we have to do it somewhere
    # should probably do it better somehow, also because
    # now dummy_col() has to be run before find_lows_zeros() etc
    self.lowestones = {
            "col" : [],
            "row" : [],
            "dim" : [],
            "col_index" : [],
            "row_index": []    
        }

    # dim here is COL DIM
    self.zerocolumns = {
        "col" : [],
        "dim" : [],
        "col_index" : []
    }
    # next: in reduced matrix, count number of 0-columns for each dim
    # then count number of lowest ones for each dim

    # go over all rows in col 0
    length = len(self.redmatrix[:][0])
    # check that the first column is a 0 column
    # (reduced homology means it should always be a 0 col)
    for i in range(length):
      # length - i just means it goes backwards up the row
      # -1 because of 0-indexing, don't want to go out of bounds
        if self.redmatrix[length - i - 1][0] == 1:
            print("ERROR! this is supposed to be a zero column, but there is a 1 at row ", length - i -1)
            break
    # if we didn't error out, we count the dummy column towards homology
    self.zerocolumns["col"].append(0)
    self.zerocolumns["dim"].append(-1)
    self.zerocolumns["col_index"].append(-1)

  def find_lows_zeros(self, all_simplices, output = False):
    # next, for column j in the matrix, check from bottom for lowest ones. 
    # if no ones are found, then it is a zero column.
    # spits out row value for lowest one in a column
    zerocol = True
    length = len(self.redmatrix[:][0])
    # this is the dummy empty set
    # I am pretty sure it is always first
    # I am also pretty sure there is always a 1 in row one
    self.lowestones["row_index"].append(-1)
    # COLUMN j
    for j in range(length):
        # we know it's a square matrix by construction 
        # ROW i
        for i in range(length):
            # here we go backwards up the columns to search for lowest ones.
            if self.redmatrix[length - i - 1][j] == 1:
              # the -1 here is because of the dummy column, right? 
              # I don't remember except that it goes out of bounds. 
              # maybe it's just that it changes it from 1 indexing to 0
                # check what dimension it is
                # find simplex in all_simplices s.t. simplex.columnvalue = j
                for x in all_simplices: 
                    # I think this is the only change we need to make.
                    if x.columnvalue == j:
                        self.lowestones["col"].append(j)
                        self.lowestones["row"].append(length - i -1)
                        self.lowestones["col_index"].append(x.index)
                        # we subtract 2 because it is ROW dim not COL!!
                        # this one took f*cking forever to find
                        self.lowestones["dim"].append(len(x.boundary) - 2)
                for y in all_simplices:
                    if y.columnvalue == length - i - 1:
                        # this is the row of col j
                        self.lowestones["row_index"].append(y.index)
                    # if y.columnvalue == 0:
                    #     # this is the row of col j
                    #     # this is the dummy empty set
                    #     self.lowestones["row_index"].append(-1)
                zerocol = False
                break
        if zerocol:
            for x in all_simplices:
                    if x.columnvalue == j:
                        self.zerocolumns["col"].append(j)
                        self.zerocolumns["dim"].append(len(x.boundary) - 1)
                        self.zerocolumns["col_index"].append(x.index)
        zerocol = True
    if output:
      print("Zero Columns:")
      for key, value in self.zerocolumns.items():
          print(key, ":", value)
      print("\nLowest Ones:")
      for key, value in self.lowestones.items():
          print(key, ":", value)

  def find_bettis(self):
    # Betti_p = #zero_p - #low_p
    betti_dummy = 0
    betti_zero = 0
    betti_one = 0
     
    for x in self.zerocolumns["dim"]:
        if x == -1:
            betti_dummy += 1
        if x == 0:
            betti_zero += 1
        if x == 1:
            betti_one += 1
            
    for x in self.lowestones["dim"]:
        if x == -1:
            betti_dummy -= 1
        if x == 0:
            betti_zero -= 1
        if x == 1:
            betti_one -= 1
    return betti_dummy, betti_zero, betti_one

  def find_bd_pairs(self, output = True):
    # we reinitialize so we can run this function multiple times
    # without worrying that things get too long and also wrong
    self.bd_pairs = {
        # initial index. we can't differentiate vert/edge this way,
        # but we can by knowing classdim, so it's fine.
        "birth": [],
        "death": [],
        "classdim": [],
        "b_simplex": [],
        "d_simplex": []
    }
    self.unpaired = {
        # classdim is the same as dim of birth simplex.
        "birth": [],
        "classdim": [],
        "b_simplex": []
    }
    died = True
    paired_index = 0
    unpaired_index = 0
    num_pairs = len(self.lowestones["col"])
    num_unpaired = len(self.zerocolumns["col"])

    for c in self.zerocolumns["col"]:
        # col c in the matrix was a birth
        # so we should check corresponding row to see
        # if there is a bd pair there
        died = False
        # we assume first that it's an inf hom class (no death)
        for r in self.lowestones["row"]:
            if r == c:
                died = True
        if died: 
            self.bd_pairs["classdim"].append(self.lowestones["dim"][paired_index])
            self.bd_pairs["death"].append(self.lowestones["col_index"][paired_index])
            self.bd_pairs["birth"].append(self.lowestones["row_index"][paired_index])

            if self.lowestones["dim"][paired_index] == -1:
                self.bd_pairs["b_simplex"].append("emptyset")
                self.bd_pairs["d_simplex"].append("v")
            if self.lowestones["dim"][paired_index] == 0:
                self.bd_pairs["b_simplex"].append("v")
                self.bd_pairs["d_simplex"].append("e")
            if self.lowestones["dim"][paired_index] == 1:
                self.bd_pairs["b_simplex"].append("e")
            paired_index += 1
        if died == False:
            self.unpaired["birth"].append(self.zerocolumns["col_index"][unpaired_index])
            self.unpaired["classdim"].append(self.zerocolumns["dim"][unpaired_index])
            if self.zerocolumns["dim"][unpaired_index] == -1:
                self.unpaired["b_simplex"].append("emptyset")
            if self.zerocolumns["dim"][unpaired_index] == 0:
                self.unpaired["b_simplex"].append("v")
            if self.zerocolumns["dim"][unpaired_index] == 1:
                self.unpaired["b_simplex"].append("e")
        unpaired_index += 1
    if output: 
      # this is more the actual output 
      # print("birth death pairs")
      # for keys, value in self.bd_pairs.items():
      #    print(keys, value)
      # print("\n") 
      # print("infinite homology classes")
      # for keys, value in self.unpaired.items():
      #    print(keys, value)

      # this is the pretty print output
      print("simplices labeled by initial val, not column:\n")
      for i in range(len(self.bd_pairs["birth"])):
        # fstrings enable v0 instead of v 0
          print(f'{self.bd_pairs["b_simplex"][i]}{self.bd_pairs["birth"][i]}', 
                "birthed a",
                f'{self.bd_pairs["classdim"][i]}dim h class killed by',
                f'{self.bd_pairs["d_simplex"][i]}{self.bd_pairs["death"][i]}', 
               )
      for i in range(len(self.unpaired["birth"])):
          print(f'{self.unpaired["b_simplex"][i]}{self.unpaired["birth"][i]}',
                "birthed an inf",
                f'{self.unpaired["classdim"][i]}dim h class',
               )

  def printexample():
    # removing "self" lets you call it on the class without a representative
    # usage: cl.bdmatrix.printexample()
    delta = np.array([\
         [0,1,0,0,0,0,0,0],\
         [0,0,0,0,1,0,0,0],\
         [0,0,0,1,1,1,0,0],\
         [0,0,0,0,0,1,0,0],\
         [0,0,0,0,0,0,0,1],\
         [0,0,0,0,0,0,0,1],\
         [0,0,0,0,0,0,0,1],\
         [0,0,0,0,0,0,0,0]])
    df1_styler = pd.DataFrame(delta).style.\
        applymap(bdmatrix.highlight_cells).\
        set_table_attributes("style='display:inline'").\
        set_caption('Original boundary matrix')
    # display call has to be here 
    # even if we change delta to temp_delta, df1 updates to be the 
    # same as df2 if we call them at the same time! Super weird.
    # consider not using Pandas if it's going to mess up data. 
    # is this one of those class issues with python where it 
    # updates the object used by the entire class?
    display(df1_styler)

    # here we alter the matrix
    delta[:,5] = (delta[:,4] + delta[:,5]) % 2

    df2_styler = pd.DataFrame(delta).style.\
        applymap(bdmatrix.highlight_cells).\
        set_table_attributes("style='display:inline'").\
        set_caption('One column addition')
    display(df2_styler)

class vineyard:
  def __init__(self):
    self.pointset = np.empty(2)
    self.complexlist = []
    self.matrixlist = []
    self.keypointlist = []
    self.grape = '-888o'
    # lows and zeros are stored in a bdmatrix

  def __repr__(self):
    # IN PROGRESS
    # f strings are easy way to turn things into strings
    return f'hello i am a vineyard'
    # usage: print(vin), where vin is a vineyard

  def add_complex(self,points, key_point, show_details = True, timethings = False, zoomzoomreduce = True):
    init_complex = initcomplex(points)
    s_complex = complex()
    s_complex.key_point = key_point

    if timethings:
      start_time = time.perf_counter() 
    # update this to .self so don't need input, except maybe key pt
    distlist = s_complex.find_sq_dist(init_complex)
    sort_complex(s_complex, distlist, plot = False)
    
    # this is the permutation
    all_simplices = s_complex.order_all_simps()
    # if (key_point == [0.5, 1]).all():
    #   print("heellloooo", all_simplices[0], all_simplices[0].coords, "keypt", key_point)
    #   print(points)


    # I am pretty sure the simps are also ordered in s_complex, 
    # not just all_simplices.
    if timethings:
      print(f"It took {time.perf_counter() - start_time :.3f} sec to sort the complex {len(self.complexlist)}")

    mat = bdmatrix()
    # assign simplices to matrix columns
    mat.make_matrix(s_complex)

    if zoomzoomreduce:
      if timethings:
        start_time = time.perf_counter() 
      mat.redmatrix = mat.smartreduce()
      if timethings:
        print(f"It took {time.perf_counter() - start_time :.3f} sec to smartreduce the matrix {len(self.matrixlist)}")
    else:
      # reduce the matrix
      if timethings:
        start_time = time.perf_counter() 
      mat.redmatrix = mat.reduce(display = False)
      if timethings:
        print(f"It took {time.perf_counter() - start_time :.3f} sec to slowreduce the matrix {len(self.matrixlist)}")


    # this adds in a column for reduced homology
    if timethings:
      start_time = time.perf_counter() 
    mat.add_dummy_col()
    # find the (r,c) vales of lowest ones in the matrix, 
    # and also identify zero columns
    mat.find_lows_zeros(all_simplices, output = False)

    betti_dummy, betti_zero, betti_one = mat.find_bettis()
    mat.find_bd_pairs(output = show_details)
    if timethings:
        print(f"It took {time.perf_counter() - start_time :.3f} sec to find bettis")
    
    if show_details:
      print("\n")
      for key, value in mat.bd_pairs.items():
        print(key,':',value)

    # add to vineyard
    self.pointset = points 
    self.complexlist.append(s_complex)
    self.matrixlist.append(mat)
    self.keypointlist.append(key_point)
    if timethings:
      print("\n")

  def is_knee(self, int_one, int_two, eps = 1, printout = False):
    # there may be more things we need to update if the ints are not 0 and 1

    # if it's an i-dimensional homology class, the birth simplex has dim i
    # I am not sure the death simplex is guaranteed to be dim i+1, so we might not have store
    # enough info earlier to look it up, as index is not unique without dimension

    # find the verts that kill the empty set
    # we can cheat a little on finding these types of knees, 
    # because there's always exactly one vert that kills the empty set 
    # if the complex is nonempty, and all the others give birth to 0 homology, 
    # so instead of looking for cross dimensional birth death switches as such, 
    # we can look just for the death of the empty simplex. 

    # now that there are no triangles, we are looking at top-dimensional,
    # ie, unpaired, simplices (edges) instead of birth-death pairs. 
    # this will need to be made more robust when we add triangles.

    pair_of_grapes = [[self.complexlist[0], self.complexlist[1]], \
                      [self.matrixlist[0], self.matrixlist[1]]]

    pair_of_deaths = []
    dims_of_deaths = []
    pair_of_unpaired = []


    # a knee involves two dims, a d dim death and a d + 1 birth. 
    # we refer to a knee by the lower (death) dimension. 
    is_emptyset_knee = False
    is_zero_knee = False

    for i in range(len(pair_of_grapes)):
        # one grape is one complex
        # all complexes have same underlying set, but different special point
        deaths = pair_of_grapes[1][i].bd_pairs["death"]
        dims = pair_of_grapes[1][i].bd_pairs["classdim"]
        for j in range(len(deaths)):
            # find the exactly one death of the empty simplex
            if dims[j] == -1:
                pair_of_deaths.append(deaths[j])
                
    if printout:
      print("verts that killed the empy set: \n",pair_of_deaths)

    # note, we are already referring to the simplices by their index, 
    # which was the initial parametric sampling, so they are in order
    # so we can use this number to find nearest neighbor relationship
    epsilon = eps

    # range is inclusive on left and excl on right, so need +1
    if pair_of_deaths[0] not in range(pair_of_deaths[1] - epsilon, pair_of_deaths[1] + epsilon +1):
        #print("I am death", pair_of_deaths[0])
        if printout:
          print("type 3 knee between key points",
                pair_of_grapes[0][0].key_point ,
                "and",
                pair_of_grapes[0][1].key_point,
               "\n( with epsilon nbhd of",
               epsilon,
               ")")
        is_emptyset_knee = True

    else:
      if printout:
        print("no type 3 knee for zero-homology",
             "(with epsilon nbhd of",
             epsilon,
             ")")

    ##############################################
    # now that there are no triangles, we are looking at top-dimensional,
    # ie, unpaired, simplices (edges) instead of birth-death pairs. 
    # this will need to be made more robust when we add triangles.

    for i in range(len(pair_of_grapes)):
        # one grape is one complex
        # all complexes have same underlying set, but different special point
        one_d_births = pair_of_grapes[1][i].unpaired["birth"]
        dims = pair_of_grapes[1][i].unpaired["classdim"]
        for j in range(len(one_d_births)):
            # find the exactly one death of the empty simplex
            if dims[j] == 1:
                pair_of_unpaired.append(one_d_births[j])

    if printout:
      print("\nedges that birthed one-homology:\n",
          pair_of_unpaired)


    if pair_of_unpaired[0] not in range(pair_of_unpaired[1] - epsilon, pair_of_unpaired[1] + epsilon):
        if printout:
          print("type 3 knee between key points",
              pair_of_grapes[0][0].key_point ,
              "and",
              pair_of_grapes[0][1].key_point,
             "\n( with epsilon nbhd of",
             epsilon,
             ")")

        is_zero_knee = True
    else:
        if printout:
          print("no type 3 knee for one-homology",
             "(with epsilon nbhd of",
             epsilon,
             ")")

    return is_emptyset_knee, is_zero_knee, epsilon 



