import numpy as np


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
    matrix = np.zeros((n, n), dtype=int)
    for col_j in range(n):
        if col_j in sparse.keys():
            for row_i in sparse[col_j]:
                matrix[row_i][col_j] = 1
    return matrix


class bdmatrix:
    initmatrix: np.array
    redmatrix: np.array

    lowestones: dict
    """
    Info about the lowest 1 in each column of the reduced matrix. 
    - `"col"`: 
    - `"row"`: 
    - `"dim"`: the dimension of the simplex for the ROW of the lowest 1.
    - `"col_index"`: original index of the simplex for the column.
    - `"row_index"`: original index of the simplex for the row.
    """
    zerocolumns: dict
    """
    In vineyards, we keep track of data every time we reduce a column to be
    zero.  The three things we keep track of are:
     - `"col"`: column index of the zeroed column
     - `"dim"`: dimension of the corresponding simplex
     - `"col_index"`: original index of the simplex.

    These are all lists of `int`s, and elements are always added to all three
    lists.
    """
    bd_pairs: dict
    unpaired: dict

    def __init__(self):
        # here, index refers as usual to the very initial index a simplex has
        # dim is the dim of column simplex, as in index
        # dim for lows is ROW DIM
        self.lowestones = {
            "col": [],
            "row": [],
            "dim": [],
            "col_index": [],
            "row_index": [],
        }

        # dim here is COL DIM
        self.zerocolumns = {"col": [], "dim": [], "col_index": []}
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
            "d_simplex": [],
        }
        self.unpaired = {
            # classdim is the same as dim of birth simplex.
            # this is needed also so we know if it's a vert or edge,
            # since the index alone doesn't tell us.
            "birth": [],
            "classdim": [],
            "b_simplex": [],
        }

    def make_matrix(self, orderedcplx):
        """
        Initialize `self.initmatrix` from the given ordered complex.
        """
        # NOTE(#6): this assumes that we don't have any triangles.
        n = len(orderedcplx.vertlist) + len(orderedcplx.edgelist) + 1
        orderedmat = np.zeros((n, n), dtype=int)

        # give all verts columns a 1 at position 0 because of empty simplex
        for i in range(len(orderedcplx.vertlist)):
            # column (orderedcplx.vertlist[i].columnvalue), row 0, gets a 1
            orderedmat[0][orderedcplx.vertlist[i].columnvalue] = 1

        # next, go over edges
        for edge in orderedcplx.edgelist:
            # column (orderedcplx.edgelist[i].columnvalue), row j, gets a 1 if
            # orderedcplx.edgelist[i].boundary contains j
            index_k = edge.boundary[0]
            index_m = edge.boundary[1]
            # now need to find row containing index k,m.
            # it is of form simplx.columnvalue = k
            # need to find simplex.columnvalue s.t. simplex.index = k
            for x in orderedcplx.vertlist:
                if x.index == index_k:
                    orderedmat[x.columnvalue][edge.columnvalue] = 1
                    break
            else:
                x = None
            for x in orderedcplx.vertlist:
                if x.index == index_m:
                    orderedmat[x.columnvalue][edge.columnvalue] = 1
                    break
            else:
                x = None
        self.initmatrix = orderedmat

    def reduce(self):
        # array2sparse is at top of file
        sparsemat = array2sparse(self.initmatrix)
        # print(sparsemat)

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
                            if (
                                findlowestone(sparsemat, j0)
                                == findlowestone(sparsemat, j)
                                and findlowestone(sparsemat, j0) != None
                            ):
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
        # print("\n", sparsemat)
        backtomat = sparse2array(sparsemat, len(self.initmatrix[:][0]))

        # NEXT: ondra's sneaky trick to speed up by an order of n:
        # reduce by dimension first (higher to lower), and L-R within
        # dimension. This takes it from n^4 to n^3 in expectation.
        return backtomat

    def add_dummy_col(self):
        """Add bookkeeping for the empty simplex."""
        # initializing here because we have to do it somewhere
        # should probably do it better somehow, also because
        # now dummy_col() has to be run before find_lows_zeros() etc
        self.lowestones = {
            "col": [],
            "row": [],
            "dim": [],
            "col_index": [],
            "row_index": [],
        }

        # dim here is COL DIM
        self.zerocolumns = {"col": [], "dim": [], "col_index": []}
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
                raise Exception(
                    "ERROR! this is supposed to be a zero column, but there is a 1 at row ",
                    length - i - 1,
                )
        # if we didn't error out, we count the dummy column towards homology
        self.zerocolumns["col"].append(0)
        self.zerocolumns["dim"].append(-1)
        self.zerocolumns["col_index"].append(-1)

    def find_lows_zeros(self, all_simplices, output=False):
        """
        Compute stuff about the reduced matrix, like which columns are zeroed,
        and which simplices correspond to the lowest 1.
        """

        # next, for column j in the matrix, check from bottom for lowest ones.
        # if no ones are found, then it is a zero column.
        # spits out row value for lowest one in a column
        zerocol = True
        length = len(self.redmatrix[:][0])
        # this is the dummy empty set
        # I am pretty sure it is always first
        # I am also pretty sure there is always a 1 in row one

        # NOTE: this makes the lists in `lowestones` not the same lenght, since
        # this one will have one more element. We'll have to remember this when
        # we use it.
        #
        # TODO: Consider adding dummy elements here so we don't have to think
        # about this later.
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
                    # NOTE: there should be =1 simplex with this column value.
                    # TODO: confirm that we find this.
                    for x in all_simplices:
                        # I think this is the only change we need to make.
                        if x.columnvalue == j:
                            self.lowestones["col"].append(j)
                            self.lowestones["row"].append(length - i - 1)
                            self.lowestones["col_index"].append(x.index)
                            # we subtract 2 because it is ROW dim not COL!!
                            # this one took f*cking forever to find
                            self.lowestones["dim"].append(len(x.boundary) - 2)
                    # NOTE: there should be =1 simplex with this column value too.
                    # TODO: confirm that we find this too.
                    for y in all_simplices:
                        if y.columnvalue == length - i - 1:
                            # this is the row of col j
                            self.lowestones["row_index"].append(y.index)
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
