from collections import defaultdict
from typing import Callable, DefaultDict, Dict, List, Optional, Set, Tuple
import numpy as np

from . import complex as cplx


def array2sparse(matrix: np.ndarray) -> Dict[int, Set[int]]:
    #     we're going to make a better repr of a matrix.
    #     we'll have a dictionary, like this:
    #     d = {
    #     c : {r1, r2, r3},
    #     }
    #     where column:row indicates the location of a 1 in the matrix.
    #     this way we don't store zeros, and computation will be faster.
    sparseboii = {}
    height, width = matrix.shape
    for col_j in range(width):
        for row_i in range(height):
            if matrix[row_i][col_j] == 1:
                if col_j not in sparseboii.keys():
                    # initialize set
                    sparseboii[col_j] = set()
                sparseboii[col_j].add(row_i)
    return sparseboii


def findlowestone(sparsemat: Dict[int, Set[int]], col_num: int) -> Optional[int]:
    # a fast way to find the lowest one
    # in a column in a sparse dict repr of
    # a boundary matrix
    # returns row num of lowest one
    if len(sparsemat[col_num]) == 0:
        return None
    else:
        return max(sparsemat[col_num])


def sparse2array(sparse: Dict[int, Set[int]], shape: Tuple[int, int]) -> np.ndarray:
    # n can be either height or width
    # by construction we only have square matrices
    matrix = np.zeros(shape, dtype=int)
    for col_j in range(shape[1]):
        if col_j in sparse.keys():
            for row_i in sparse[col_j]:
                matrix[row_i][col_j] = 1
    return matrix


class bdmatrix:
    initmatrix: np.ndarray
    redmatrix: np.ndarray
    """
    Probably this is old and should not be used any more?
    """

    reduced: Optional[np.ndarray]
    """
    Reduced matrix, if computed.
    """
    sparse_reduced: Optional[Dict[int, Set[int]]]
    """
    `reduced`, but in sparse form.
    """

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
    """
    Debugging info, set in `find_bd_pairs`.  This is also used in `vineyard.is_knee`.

    Info about birth-death pairs. Here we are five lists
    - `"birth"`: birth index
    - `"death"`: death index
    - `"classdim"`: dimension of the birth simplex
    - `"b_simplex"`: birth simplex pretty printed simplex type (emptyset/v/e).
    - `"d_simplex"`: death simplex pretty printed simplex type (emptyset/v/e).
    """
    unpaired: dict
    """
    Debugging info, set in `find_bd_pairs`.

    Info about unpaired simplices. Here we are three lists
    - `"birth"`: birth index
    - `"classdim"`: dimension of the simplex
    - `"b_simplex"`: birth simplex pretty printed simplex type (emptyset/v/e).
    """

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

    def make_matrix(self, orderedcplx: cplx.complex):
        """
        Initialize `self.initmatrix` from the given ordered complex.
        """
        # NOTE(#6): this assumes that we don't have any triangles.
        n = len(orderedcplx.vertlist) + len(orderedcplx.edgelist) + 1
        orderedmat = np.zeros((n, n), dtype=int)

        # give all verts columns a 1 at position 0 because of empty simplex
        for vertex in orderedcplx.vertlist:
            orderedmat[0][vertex.columnvalue] = 1

        # Easy access to columnvalue when all we have is index.
        vertex_index_to_columnvalue = {
            v.index: v.columnvalue for v in orderedcplx.vertlist
        }

        for edge in orderedcplx.edgelist:
            [i, j] = edge.boundary
            orderedmat[vertex_index_to_columnvalue[i]][edge.columnvalue] = 1
            orderedmat[vertex_index_to_columnvalue[j]][edge.columnvalue] = 1

        self.initmatrix = orderedmat

    def from_ordering(ordering: cplx.ordering):
        mat = bdmatrix()

        n = ordering.complex.nsimplices()
        mat.initmatrix = np.zeros((2, 1 + len(ordering.complex.vertlist)), dtype=int)

        for simplex in ordering.complex.vertlist:
            dim = simplex.dim()
            if dim == -1:
                pass
            elif dim == 0:
                # give all verts columns a 1 at position 0 because of empty simplex
                matrix_index = ordering.matrix_index(simplex)
                mat.initmatrix[0][matrix_index] = 1
            elif dim == 1:
                edge_i = ordering.matrix_index(simplex)
                [i, j] = simplex.boundary
                mat.initmatrix[ordering.matrix_index_for_dim(0, i)][edge_i] = 1
                mat.initmatrix[ordering.matrix_index_for_dim(0, j)][edge_i] = 1
            elif dim == 2:
                tri_i = ordering.matrix_index(simplex)
                [i, j, k] = simplex.boundary
                mat.initmatrix[ordering.matrix_index_for_dim(1, i)][tri_i] = 1
                mat.initmatrix[ordering.matrix_index_for_dim(1, j)][tri_i] = 1
                mat.initmatrix[ordering.matrix_index_for_dim(1, k)][tri_i] = 1
            else:
                raise Exception("Invalid simplex dimension")

        return mat

    def reduce(
        self,
        every_step: Optional[
            Callable[[Dict[int, Set[int]], Tuple[int, int], Set[int]], None]
        ] = None,
        after_column_reduced: Optional[
            Callable[[Dict[int, Set[int]], int], None]
        ] = None,
    ):
        """
        `every_step`: callback function after a column operation has been done. Takes three arguments:
        1. The sparse matrix.
        2. The indices of the columns being added.
        3. The old target column.
        """
        sparsemat = array2sparse(self.initmatrix)

        # from monster book:
        # j is column
        # for j = 1 to m do:
        #    while there exists j0 < j s.t. low(j0) = low(j) do:
        #      add column j0 to column j
        #    end while
        # end for

        # Call the function for the empty simplex.
        if after_column_reduced:
            after_column_reduced(sparsemat, 0)

        number_of_cols = len(self.initmatrix[:][0])
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
                                old_j = sparsemat[j]
                                sparsemat[j] = sparsemat[j] ^ sparsemat[j0]
                                if every_step:
                                    every_step(sparsemat, (j, j0), old_j)
                                # restart the while loop
                                should_restart = True
                                break
                    if should_restart:
                        continue
                    else:
                        if after_column_reduced:
                            after_column_reduced(sparsemat, j)
                        break

        # get rid of empty cols
        for j in range(number_of_cols):
            if j in sparsemat.keys():
                if len(sparsemat[j]) == 0:
                    sparsemat.pop(j)
        # print("\n", sparsemat)

        self.sparse_reduced = sparsemat
        backtomat = sparse2array(sparsemat, self.initmatrix.shape)
        self.reduced = backtomat

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

    def find_lows_zeros(self, all_simplices: List[cplx.simplex], output=False):
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

        # NOTE: this makes the lists in `lowestones` not the same length, since
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

    def compute_lowest_1s(self, simplices: List[cplx.simplex]) -> List[Dict[str, int]]:
        """
        Compute information about the lowest 1s in the reduced matrix. `reduce` must be called
        before this is called.
        Returns a list of objects with these fields:
         - `col`
         - `row`
         - `dim`
         - `col_index`
         - `row_index`

        just like the previous version.  See `find_lows_zeros` for more info.
        """
        i2simplex = {s.columnvalue: s for s in simplices}
        i2simplex[0] = cplx.simplex.empty()
        if not self.sparse_reduced:
            raise Exception("Must call `reduce` before `compute_lowest_1s`")
        lowest = []
        zeroed = []
        # TODO: should double check the 1 here; looks funny.
        for col in range(1, self.initmatrix.shape[0]):
            rows = self.sparse_reduced.get(col, set())
            low = max(rows) if rows else None
            if low == None:
                simplex = i2simplex[col]
                item = {
                    "col": col,
                    "dim": simplex.dim(),
                    "col_index": simplex.index,
                }
                zeroed.append(item)
            else:
                item = {
                    "col": col,
                    "row": low,
                    "dim": i2simplex[low].dim(),
                    "col_index": i2simplex[col].index,
                    "row_index": i2simplex[low].index,
                }
                lowest.append(item)
        return lowest, zeroed

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

    def find_bd_pairs(self, output=True):
        # we reinitialize so we can run this function multiple times
        # without worrying that things get too long and also wrong
        self.bd_pairs = {
            # initial index. we can't differentiate vert/edge this way,
            # but we can by knowing classdim, so it's fine.
            "birth": [],
            "death": [],
            "classdim": [],
            "b_simplex": [],
            "d_simplex": [],
        }
        self.unpaired = {
            # classdim is the same as dim of birth simplex.
            "birth": [],
            "classdim": [],
            "b_simplex": [],
        }
        died = True
        paired_index = 0
        unpaired_index = 0

        # We're looking for a zeroed out column `c` with the same index as a row `r`
        # containing the lowest 1 in its column.

        # If no such pair exist, then we've gotten a hom class.  For instance,
        # the last edge in a triangle will be zeroed out, but without a triangle
        # to fill the hole, it's a hom class.

        for c in self.zerocolumns["col"]:
            # col c in the matrix was a birth
            # so we should check corresponding row to see
            # if there is a bd pair there
            died = False
            # we assume first that it's an inf hom class (no death)
            for r in self.lowestones["row"]:
                if r == c:
                    print(f"r={r} c={c}")
                    died = True
            if died:
                self.bd_pairs["classdim"].append(self.lowestones["dim"][paired_index])
                self.bd_pairs["death"].append(
                    self.lowestones["col_index"][paired_index]
                )
                self.bd_pairs["birth"].append(
                    self.lowestones["row_index"][paired_index]
                )

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
                self.unpaired["birth"].append(
                    self.zerocolumns["col_index"][unpaired_index]
                )
                self.unpaired["classdim"].append(
                    self.zerocolumns["dim"][unpaired_index]
                )
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
                print(
                    f'{self.bd_pairs["b_simplex"][i]}{self.bd_pairs["birth"][i]}',
                    "birthed a",
                    f'{self.bd_pairs["classdim"][i]}dim h class killed by',
                    f'{self.bd_pairs["d_simplex"][i]}{self.bd_pairs["death"][i]}',
                )
            for i in range(len(self.unpaired["birth"])):
                print(
                    f'{self.unpaired["b_simplex"][i]}{self.unpaired["birth"][i]}',
                    "birthed an inf",
                    f'{self.unpaired["classdim"][i]}dim h class',
                )


class reduction_knowledge:
    """
    This class is used to keep track of knowledge we obtain in the reduction
    process. This includes
     - Betti numbers
    """

    ord: cplx.ordering

    bettis: DefaultDict[int, int]

    birth_death_pairs: Dict[int, int]
    """If the homology class is infinite, the value is `-1`."""
    death_birth_pairs: Dict[int, int]

    adds: List[Tuple[int, int]]
    """All of the column adds performed when reducing the matrix as tuples
    `(target, other)` for when `other` is added onto `target`."""

    def __init__(self, matrix: bdmatrix, ord: cplx.ordering):
        self.matrix = matrix
        self.ordering = ord
        self.bettis = defaultdict(int)
        self.birth_death_pairs = dict()
        """birth_death_pairs[row] = col"""
        self.death_birth_pairs = dict()
        """death_birth_pairs[col] = row"""
        self.adds = []

    def run(self):
        self.matrix.reduce(
            every_step=self.every_step, after_column_reduced=self.after_column_reduced
        )

    def every_step(self, sparsemat, indices, old_target):
        self.adds.append(indices)

    def after_column_reduced(self, sparsemat, col):
        c = sparsemat.get(col, set())
        s = self.ordering.get_simplex(col)
        if s.dim() not in self.bettis:
            self.bettis[s.dim()] = 0
        if c:
            lowest = max(c)
            birth = self.ordering.get_simplex(lowest)
            self.bettis[birth.dim()] -= 1
            self.birth_death_pairs[lowest] = col
            self.death_birth_pairs[col] = lowest
        else:
            self.bettis[s.dim()] += 1
            # NOTE: We record all births as living forever; if it gets killed,
            # this will be overwritten in the `if c:` branch.
            self.birth_death_pairs[col] = -1

    def gives_birth(self, i: int) -> bool:
        """`True` if the simplex at row index `i` gave birth."""
        return i in self.birth_death_pairs

    def gives_death(self, i: int) -> bool:
        """`True` if the simplex at column index `i` gave death."""
        return i in self.death_birth_pairs
