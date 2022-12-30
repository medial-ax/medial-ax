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

class bdmatrix: 
  def __init__(self):
    self.temp = "temp"
    self.matrix = np.array([\
         [0,1,0,0,0,0,0,0],\
         [0,1,1,0,0,0,0,0],\
         [0,0,1,1,0,0,0,0],\
         [0,0,0,1,1,0,0,0],\
         [0,0,0,0,1,1,0,0],\
         [0,0,0,0,0,1,1,0],\
         [0,0,0,0,0,0,1,1],\
         [0,0,0,0,0,0,0,0]])

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
              return length - i - 1
      return None


  def reduce(self):
      matrix = deepcopy(self.matrix)
      dfstyles = []
      print("columns: ", matrix[0,:].size, " rows: ", matrix[:,0].size)
      cell_hover = {  # for row hover use <tr> instead of <td>
          'selector': 'td:hover',
          'props': [('background-color', '#ffffb3')]
      }


      stylestring = pd.DataFrame(matrix).style.\
      applymap(bdmatrix.highlight_cells).\
      set_table_styles([cell_hover], 'columns').\
      set_table_attributes("style='display:inline'").\
      set_caption('Initial matrix')._repr_html_()
      
      # for each column i 
      for i in range(matrix[0,:].size):
          col_i = matrix[:,i]
  #         print("column", i)
          # For each column j left of column i, if low(j) = low(i), add j to i
          # this needs to be a while loop bc one of the ops could add a 1 back in
          while True:
              should_restart = False
              for j in range(i):
                  col_j = matrix[:,j]
      #             print(col_j, "\n")
                  if (bdmatrix.lowest_one(col_j) == bdmatrix.lowest_one(col_i)) and (bdmatrix.lowest_one(col_j) != None):
      #                 print("lowest one in ", j, " same as in ", i)
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

      
          # while there exists column ... 
          # (function that checks block of columns and outputs column with same lowest one)
  #             check_left(j, matrix)
      for style in dfstyles: 
          stylestring = stylestring + style
      display_html(stylestring, raw=True)
      return matrix


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

