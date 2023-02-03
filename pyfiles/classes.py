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

def ellipse_example(numpts = 7):
  # parametric eq for ellipse: 
  # $F(t) = (x(t), y(t))$, where $x(t) = a*cos(t)$ and $y(t) = b*sin(t)$

  # parameters for ellipse shape and sampling density
  a = 5
  b = 2

  # c is number of points
  c = numpts
  t = np.arange(0.0, 6.28, 6.28/c)
  fig, (ax1, ax2) = plt.subplots(1,2, sharey = True)
  x = a*np.cos(t)
  y = b*np.sin(t)
  points = np.array(list(zip(x,y)))
  vor = Voronoi(points)

  # plot ellipse
  ax1.set_xlim(-(max(a,b) + 1), (max(a,b) + 1))
  ax1.set_ylim(-(max(a,b) + 1), (max(a,b) + 1))
  ax1.set_aspect('equal')
  ax1.plot(x,y,'o')

  # plot voronoi stuff
  ax2.set_xlim(-(max(a,b) + 1), (max(a,b) + 1))
  ax2.set_ylim(-(max(a,b) + 1), (max(a,b) + 1))
  ax2.set_aspect('equal')
  voronoi_plot_2d(vor, ax2, show_vertices=True, line_alpha = 0, show_points = True, point_colors='orange', point_size=10)

  fig.set_figwidth(20)
  fig.set_figheight(20)
  plt.show()
  return points

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


    # plt.plot(x[edges.T], y[edges.T], linestyle='-', color='y',
    #     markerfacecolor = 'white', marker='o') 

    for i in range(len(x)):
      smartcolor = (1 - .7*(dists[i])/max(dists), 1 - .6*(dists[i])/max(dists), .8)
      #smartcolor = (.3, .8, .6)

      # plot edges with smart color assignment: 
      point1 = [x[i], y[i]]
      point2 = [x[(i + 1)%len(x)], y[(i + 1)%len(x)]]  
      x_values = [point1[0], point2[0]]
      y_values = [point1[1], point2[1]]
      plt.plot(x_values, y_values, color = smartcolor, linewidth = 8)

    # the only reason these aren't in the same for loop is because one vertex is always under an edge
    # it would be nicer obviously not to repeat the loop
    for i in range(len(x)):  
      # plot vertices with smart color assignment
      smartcolor = (1 - .7*(dists[i])/max(dists), 1 - .6*(dists[i])/max(dists), .8)
      #smartcolor = (.3, .8, .6)

      plt.plot(x[i], y[i], color = smartcolor, marker='o', markersize = 15) 
      # add labels to points
      offset = 0.14
      plt.text(x[i] + offset, y[i] + offset, str(self.vertlist[i].orderedindex), fontsize = 14, bbox = dict(facecolor='white', alpha=0.75, edgecolor = 'white'))


    # plot key point (we calculate dist from this)
    plt.plot(self.key_point[0], self.key_point[1], color = 'red', marker = 'o', markersize = 10)
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
        temp_edge.index = i + 1 # maybe this makes no sense
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
    s_complex.plot()

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

  def reduce(self, display = True):
      matrix = deepcopy(self.initmatrix)
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
          # For each column j left of column i, if low(j) = low(i), add j to i
          # this needs to be a while loop bc one of the ops could add a 1 back in
          while True:
              should_restart = False
              for j in range(i):
                  col_j = matrix[:,j]
                  if (bdmatrix.lowest_one(col_j) == bdmatrix.lowest_one(col_i)) and (bdmatrix.lowest_one(col_j) != None):
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
    length = len(self.redmatrix[:][0])
    # check that the first column is a 0 column
    # (reduced homology means it should always be a 0 col)
    for i in range(length):
        if self.redmatrix[length - i - 1][0] == 1:
            print("ERROR! this is supposed to be a zero column, but there is a 1 at row ", length - i -1)
            break
    # if we didn't error out, we count the dummy column towards homology
    self.zerocolumns["col"].append(0)
    self.zerocolumns["dim"].append(-1)
    self.zerocolumns["col_index"].append(-1)

  def find_lows_zeros(self, all_simplices):
    # next, for column j in the matrix, check from bottom for lowest ones. 
    # if no ones are found, then it is a zero column.
    # spits out row value for lowest one in a column
    zerocol = True
    length = len(self.redmatrix[:][0])
    # this is the dummy empty set
    # I am pretty sure it is always first
    # I am also pretty sure there is always a 1 in row one
    self.lowestones["row_index"].append(-1)
    for j in range(length):
        # we know it's a square matrix by construction 
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
    #                     print(x)
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
    #                     print(x)
        zerocol = True

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

