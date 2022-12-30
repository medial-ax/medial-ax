import numpy as np
from scipy.spatial import distance
# visualization
from scipy.spatial import Voronoi, voronoi_plot_2d
import matplotlib.pyplot as plt
import matplotlib as mpl
from matplotlib.colors import ListedColormap, LinearSegmentedColormap

class simplex: 
  def __init__(self):
    # here we initialize everything. if defining an attribute with a function, must init func first.
    self.coords = []
    self.boundary = []
    self.index = -1
    self.orderedindex = -1
    # index is an int value that is the ordering of the simp
    self.dim = -1
    self.radialdist = -1.0

  def __repr__(self):
      # IN PROGRESS
      # f strings are easy way to turn things into strings
      return f'simplex ind is {self.index}, dim is {self.dim}, coords are {self.coords}, boundary is {self.boundary}, and dist is {self.radialdist}.'
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

  def plot(self):
    points = np.array([v.coords for v in self.vertlist])
    # print(points)

    # edges are repr as indices into points
    edges = np.array([e.boundary for e in self.edgelist])
    
    x = points[:,0].flatten()
    y = points[:,1].flatten()

    dists = [v.radialdist for v in self.vertlist]
    inds = [v.index for v in self.vertlist]
    print(dists)


    plt.plot(x[edges.T], y[edges.T], linestyle='-', color='y',
        markerfacecolor = 'white', marker='o') 

    for i in range(len(x)):

      plt.plot(x[i], y[i], color = (1 - .7*(dists[i])/max(dists), 1 - .6*(dists[i])/max(dists), .8), marker='o') 
    
    # This should not be hardcoded
    plt.plot(self.key_point[0], self.key_point[1], color = 'red', marker = 'o')
    plt.show()

  def print_inds(self):
    print(self.nverts, " indices")
    for i in range(self.nverts()):
      print("orig ", self.vertlist[i].index, " new: ", self.vertlist[i].orderedindex)
  
  def nedges(self):
    return len(self.edgelist)

  def nverts(self):
    return len(self.vertlist)