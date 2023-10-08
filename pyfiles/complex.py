from collections import defaultdict
from typing import Dict, List, Tuple
import numpy as np

from scipy.spatial import distance
from pprint import pprint


def augment_with_radialdist(complex: complex) -> List[float]:
    """
    Sets the `radialdist` attribute of every vertex in the complex.
    """
    ret = []
    for s in complex.vertlist:
        # This has to be the squared euclidean distance, and not just the regular one.
        dist = distance.sqeuclidean(complex.key_point, s.coords)
        s.radialdist = dist
        ret.append(dist)
    return ret


class simplex:
    coords: List[float]
    """If the simplex is a point, this is the coordinates of the point.
        If not, this is empty."""
    boundary: List[int]
    index: int
    """A unique identifier for the simplex.  Only unique for each dimension."""
    columnvalue: int
    """This is the index of the column in the boundary matrix.  This is 1-indexed because of
    the dummy column used for the empty set."""
    radialdist: float
    """This is the radial distance of the simplex from the key point."""
    parents: List[int]
    """This is a list of the indices of the simplices that are the parents of this simplex."""

    def empty():
        """Create a new simplex for the empty set."""
        s = simplex()
        s.coords = []
        s.boundary = []
        s.index = -1
        s.orderedindex = -1
        s.radialdist = -1.0
        s.parents = []
        return s

    def point(coord: List[float], index: int):
        """Create a new point simplex with given coordinates and index."""
        s = simplex()
        s.coords = coord
        s.boundary = [-1]
        s.index = index
        s.orderedindex = -1
        s.radialdist = -1.0
        s.parents = []
        return s

    def edge(boundary: List[int], index: int):
        """Create a new edge simplex with given boundary and index."""
        s = simplex()
        s.coords = []
        s.boundary = boundary
        assert len(boundary) == 2
        s.index = index
        s.columnvalue = -1
        s.radialdist = -1.0
        s.parents = []
        return s

    def __init__(self):
        self.coords = []
        self.boundary = []
        self.index = -1

        # NOTE: columnvalue is not in reduced notation! in the actual matrix,
        # add 1 because of the dummy column.
        self.columnvalue = -1
        # this is redundant
        self.radialdist = -1.0
        self.parents = []

    def dim(self):
        return len(self.boundary) - 1

    def prettyrepr(self):
        dim = self.dim()
        if dim == -1:
            c = "∅"
        elif dim == 0:
            c = f"v{self.index}"
        elif dim == 1:
            c = f"e{self.index}"
        else:
            raise Exception("Only works for simplices of dimension 0 or 1")
        return c

    def __repr__(self):
        dim = self.dim()
        if dim == -1:
            c = "∅"
        elif dim == 0:
            c = f"v{self.index}"
        elif dim == 1:
            c = f"e{self.index}"
        else:
            raise Exception("Only works for simplices of dimension 0 or 1")
        return f"simplex {c} bd {self.boundary}"


class complex:
    vertlist: List[simplex]
    edgelist: List[simplex]
    key_point: List[float]

    coboundary: Dict[int, List[int]]
    """
    A dictionary mapping the index of a simplex to a list of the indices of
    the simplices that are its coboundary.  The indices here are indices into `compex.egelist`.
    """

    def __init__(self):
        # seems like it's fine to have lists as long as they're not parameters of the class
        # otherwise, they're shared by the whole class and that is no
        self.edgelist = []
        self.vertlist = []
        self.key_point = [0.0, 0.0]

    def __repr__(self):
        return f"number of verts is {self.nverts()}, and number of edges is {self.nedges()}."

    def nedges(self):
        return len(self.edgelist)

    def nverts(self):
        return len(self.vertlist)

    def check_simplex_indices_are_okay(self):
        for i, v in enumerate(self.vertlist):
            assert v.index == i
        for i, e in enumerate(self.edgelist):
            assert e.index == i

    def setup_coboundaries(self):
        self.coboundary = defaultdict(list)
        for ei, e in enumerate(self.edgelist):
            for i in e.boundary:
                self.coboundary[i].append(ei)

    def get_coboundary(self, splx: simplex) -> List[simplex]:
        """
        Get the coboundary of the given simplex.
        """
        assert splx.dim() == 0, "only works for vertices"
        return [self.edgelist[i] for i in self.coboundary[splx.index]]

    def sort_by_dist(self, distlist: List[float]):
        """Sort the vertices with the given list of distances.  Other simplices
        are ordered by the largest distance of any face simplex.

        Sets the `columnvalue` for every simplex in the complex.
        """
        all_simplices = self.vertlist + self.edgelist

        def key(s: simplex):
            dim = s.dim()
            if dim == 0:
                return (distlist[s.index], 0, s.index)
            elif dim == 1:
                return (max([distlist[i] for i in s.boundary]), 1, s.index)
            else:
                raise Exception("Only works for simplices of dimension 0 or 1")

        all_simplices.sort(key=key)
        for i, s in enumerate(all_simplices):
            s.columnvalue = i + 1

        # Assert that all simplices have a lower columnvalue than their faces
        for e in self.edgelist:
            a = self.vertlist[e.boundary[0]]
            b = self.vertlist[e.boundary[1]]
            assert a.columnvalue < e.columnvalue
            assert b.columnvalue < e.columnvalue

        return all_simplices


class ordering:
    complex: complex
    key_point: np.ndarray

    o2i: Dict[int, Tuple[int, int]]
    """column value to unique index.  The unique index is (dim, index)."""
    i2o: Dict[Tuple[int, int], int]
    """unique index to column value.  The unique index is (dim, index)."""

    def list_unique_index(self):
        """
        Return a list of the unique indices in the ordering.
        """
        n = 1 + self.complex.nverts() + self.complex.nedges()
        return [self.o2i[i] for i in range(n)]

    def by_dist_to(complex: complex, key_point: np.ndarray):
        """
        Create an ordering of the simplices in the complex by their distance to
        the given point.
        """
        vert_distances = [
            distance.sqeuclidean(key_point, s.coords) for s in complex.vertlist
        ]
        all_simplices = [simplex.empty()] + complex.vertlist + complex.edgelist

        def key(s: simplex):
            dim = s.dim()
            if dim == -1:
                return (-1, 0, s.index)
            elif dim == 0:
                return (vert_distances[s.index], 0, s.index)
            elif dim == 1:
                # TODO: think more about if the ordering here has to be constant so that we don't get a bunch of irrelevant swaps
                # [first_vert, last_vert] = sorted(
                #     [vert_distances[i] for i in s.boundary]
                # )
                # return (last_vert, 1, first_vert)
                return (max([vert_distances[i] for i in s.boundary]), 1, s.index)
            else:
                raise Exception("Only works for simplices of dimension 0 or 1")

        all_simplices.sort(key=key)
        pairs = [((s.dim(), s.index), i) for i, s in enumerate(all_simplices)]

        o = ordering()
        o.complex = complex
        o.key_point = key_point
        o.i2o = dict(pairs)
        o.o2i = dict([(v, k) for k, v in pairs])
        return o

    def matrix_index(self, simplex: simplex):
        """
        Return the column index of the simplex in the boundary matrix.
        """
        return self.i2o[(simplex.dim(), simplex.index)]

    def matrix_index_for_dim(self, dim, index):
        """
        Return the column index of the simplex in the boundary matrix for the
        given dimension.
        """
        return self.i2o[(dim, index)]

    def get_simplex(self, i):
        """
        Get the simplex corresponding to this column index.
        """
        (dim, index) = self.o2i[i]
        if dim == -1:
            return simplex.empty()
        elif dim == 0:
            return [v for v in self.complex.vertlist if v.index == index][0]
        elif dim == 1:
            return [e for e in self.complex.edgelist if e.index == index][0]
        else:
            raise Exception("Only works for simplices of dimension 0 or 1")

    def compute_transpositions(
        self, other
    ) -> Tuple[List[Tuple[simplex, simplex]], List[List[int]], List[int]]:
        """
        `self` should be the ordering at we already have the reduced matrix.

        Returns three things:

         1. A list of `(Simplex, Simplex)` for each swap
         2. A list of the full order after each swap, which is used for plotitng.
         3. A list of indices into the list that we're sorting, corresponding to each swap. `i` in this list means that `i` and `i+1` were swapped.
        """
        our = self.list_unique_index()
        n = len(our)
        full_order = [list(range(n))]
        swaps = []
        index_swaps = []

        # Bubble sort the list of indices to find the swaps. The key is `i -> other.i2o[our[i]]``

        for _ in range(n):
            for i in range(n - 1):
                if other.i2o[our[i]] > other.i2o[our[i + 1]]:
                    our[i], our[i + 1] = our[i + 1], our[i]
                    index_swaps.append(i)
                    swaps.append(
                        (
                            self.get_simplex(self.i2o[our[i]]),
                            self.get_simplex(self.i2o[our[i + 1]]),
                        )
                    )
                    full_order.append([self.i2o[o] for o in our])

        return swaps, full_order, index_swaps

    def __repr__(self):
        return " — ".join(
            [
                self.get_simplex(self.i2o[s]).prettyrepr()
                for s in self.list_unique_index()
            ]
        )
