from collections import defaultdict
from typing import Dict, List, Tuple
import numpy as np

from scipy.spatial import distance
from pprint import pprint

from . import utils
import mars

from pyfiles.utils import Timed


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
    coords: List[float] | List[List[float]]
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

    def triangle(boundary: List[int], index: int, coords: List[List[float]]):
        """Create a new triangle simplex with given boundary and index."""
        s = simplex()
        s.coords = coords
        s.boundary = boundary
        assert len(boundary) == 3
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
        elif dim == 2:
            c = f"t{self.index}"
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
        elif dim == 2:
            c = f"t{self.index}"
        else:
            raise Exception("Only works for simplices of dimension 0 or 1")
        return f"simplex {c} bd {self.boundary}"


class complex:
    vertlist: List[simplex]
    edgelist: List[simplex]
    trilist: List[simplex]
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
        self.trilist = []
        self.key_point = [0.0, 0.0]

    def nsimplices(self):
        return 1 + len(self.vertlist) + len(self.edgelist) + len(self.trilist)

    def all_simplices(self):
        return [simplex.empty()] + self.vertlist + self.edgelist + self.trilist

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
        for ti, t in enumerate(self.trilist):
            for i in t.boundary:
                self.coboundary[i].append(ti)

    def get_coboundary(self, splx: simplex) -> List[simplex]:
        """
        Get the coboundary of the given simplex.
        """
        assert splx.dim() == 0, "only works for vertices"
        return [self.edgelist[i] for i in self.coboundary[splx.index]]

    def get_simplex(self, dim: int, id: int) -> simplex:
        if dim == 0:
            return self.vertlist[id]
        elif dim == 1:
            return self.edgelist[id]
        elif dim == 2:
            return self.trilist[id]
        else:
            raise Exception("Only works for simplices of dimension 0, 1, or 2")

    def sort_by_dist(self, distlist: List[float]):
        """Sort the vertices with the given list of distances.  Other simplices
        are ordered by the largest distance of any face simplex.

        Sets the `columnvalue` for every simplex in the complex.
        """
        all_simplices = self.vertlist + self.edgelist + self.trilist

        def key(s: simplex):
            dim = s.dim()
            if dim == 0:
                return (distlist[s.index], 0, s.index)
            elif dim == 1:
                return (max([distlist[i] for i in s.boundary]), 1, s.index)
            elif dim == 2:
                vertices = []
                for ei in s.boundary:
                    edge = self.edgelist[ei]
                    for vi in edge.boundary:
                        vertices.append(self.vertlist[vi])
                return (max([distlist[v.index] for v in vertices]), 2, s.index)
            else:
                raise Exception("Only works for simplices of dimension 0, 1, or 2")

        all_simplices.sort(key=key)
        for i, s in enumerate(all_simplices):
            s.columnvalue = i + 1

        # Assert that all simplices have a lower columnvalue than their faces
        for e in self.edgelist:
            a = self.vertlist[e.boundary[0]]
            b = self.vertlist[e.boundary[1]]
            assert a.columnvalue < e.columnvalue
            assert b.columnvalue < e.columnvalue

        for t in self.trilist:
            a = self.edgelist[t.boundary[0]]
            b = self.edgelist[t.boundary[1]]
            c = self.edgelist[t.boundary[2]]
            assert a.columnvalue < t.columnvalue
            assert b.columnvalue < t.columnvalue
            assert c.columnvalue < t.columnvalue

        return all_simplices

    def simplex_to_center(self, simplex: simplex):
        """
        Get the coordinates of the center of the given simplex.
        """
        dim = simplex.dim()
        if dim == 0:
            return np.array(simplex.coords)
        elif dim == 1:
            a = self.vertlist[simplex.boundary[0]]
            b = self.vertlist[simplex.boundary[1]]
            return (a.coords + b.coords) / 2
        elif dim == 2:
            a = simplex.coords[0]
            b = simplex.coords[1]
            c = simplex.coords[2]
            return (a + b + c) / 3
        else:
            raise Exception(
                f"Only works for simplices of dimension 0, 1, or 2; was {dim}"
            )


_COMPLEX = complex


class ordering:
    complex: complex
    key_point: np.ndarray

    o2i: Dict[int, Tuple[int, int]]
    """column value to unique index.  The unique index is (dim, index)."""
    i2o: Dict[Tuple[int, int], int]
    """unique index to column value.  The unique index is (dim, index)."""

    entrance_value: Dict[Tuple[int, int], float]
    """The entrance value for each uniqe index. The unique index is (dim, index)."""

    def list_unique_index(self):
        """
        Return an ordered list of the unique indices in the ordering.
        """
        n = self.complex.nsimplices()
        return [self.o2i[i] for i in range(n)]

    def by_dist_to(complex: _COMPLEX, key_point: np.ndarray):
        """
        Create an ordering of the simplices in the complex by their distance to
        the given point.
        """
        vert_distances = [
            distance.sqeuclidean(key_point, s.coords) for s in complex.vertlist
        ]
        all_simplices = complex.all_simplices()

        def key(s: simplex):
            dim = s.dim()
            if dim == -1:
                return (-1, 0, s.index)
            elif dim == 0:
                return (vert_distances[s.index], 0, s.index)
            elif dim == 1:
                return (max([vert_distances[i] for i in s.boundary]), 1, s.index)
            elif dim == 2:
                vertex_indices = []
                for ei in s.boundary:
                    edge = complex.edgelist[ei]
                    vertex_indices.extend(edge.boundary)
                return (max([vert_distances[v] for v in vertex_indices]), 2, s.index)
            else:
                raise Exception("Only works for simplices of dimension 0, 1, or 2")

        all_simplices.sort(key=key)
        pairs = [((s.dim(), s.index), i) for i, s in enumerate(all_simplices)]

        o = ordering()
        o.complex = complex
        o.key_point = key_point
        o.i2o = dict(pairs)
        o.o2i = dict([(v, k) for k, v in pairs])

        o.entrance_value = {(s.dim(), s.index): key(s)[0] for s in all_simplices}

        # Check that the simplices are ordered correctly
        for i, s in enumerate(all_simplices):
            if s.dim() > 0:
                for face in s.boundary:
                    face_i = o.i2o[(s.dim() - 1, face)]
                    assert face_i < i

        o.vert_map = {s.index: s for s in complex.vertlist}
        o.edge_map = {s.index: s for s in complex.edgelist}
        o.tri_map = {s.index: s for s in complex.trilist}

        return o

    def get_entrance_value(self, simplex: simplex) -> float:
        """
        Get the entrance value of the given simplex.
        """
        return self.entrance_value[(simplex.dim(), simplex.index)]

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
            return self.vert_map[index]
        elif dim == 1:
            return self.edge_map[index]
        elif dim == 2:
            return self.tri_map[index]
        else:
            raise Exception("Only works for simplices of dimension 0, 1, or 2")

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

        # Bubble sort the list of indices to find the swaps. The key is `i ->
        # other.i2o[our[i]]`, so that we sort `our` by the order in `other`.

        # Compute upper and lower bounds on the two orders so that we don't have
        # to blindly check all pairs if the two orders are already mostly
        # sorted. If the two orders are the same in a segment from the start,
        # this will never be touched by the swaps, so we can start at the first
        # index where they differ.  Same for the end.
        i0 = 0
        while i0 < n and other.i2o[our[i0]] == other.i2o[our[i0 + 1]]:
            i0 += 1
        i1 = n - 1
        while i0 < i1 and other.i2o[our[i1 - 1]] == other.i2o[our[i1]]:
            i1 -= 1
        steps = i1 - i0 + 1

        for _ in range(steps):
            did_swap = False
            for i in range(i0, i1):
                if other.i2o[our[i]] > other.i2o[our[i + 1]]:
                    our[i], our[i + 1] = our[i + 1], our[i]
                    index_swaps.append(i)
                    with utils.Timed("Suspicious"):
                        swaps.append(
                            (
                                self.get_simplex(self.i2o[our[i]]),
                                self.get_simplex(self.i2o[our[i + 1]]),
                            )
                        )
                    full_order.append([self.i2o[o] for o in our])
                    did_swap = True
            if not did_swap:
                break

        return swaps, full_order, index_swaps

    def __repr__(self):
        return " — ".join(
            [
                self.get_simplex(self.i2o[s]).prettyrepr()
                for s in self.list_unique_index()
            ]
        )

    def compute_transpositions_lean(
        self, other
    ) -> Tuple[List[Tuple[simplex, simplex]], List[int]]:
        """
        `self` should be the ordering at we already have the reduced matrix.

        Returns three things:

         1. A list of `(Simplex, Simplex)` for each swap
         2. A list of the full order after each swap, which is used for plotitng.
         3. A list of indices into the list that we're sorting, corresponding to each swap. `i` in this list means that `i` and `i+1` were swapped.
        """
        with utils.Timed("compute_transpositions_lean"):
            our = self.list_unique_index()
            n = len(our)
            swaps = []
            index_swaps = []

            # Bubble sort the list of indices to find the swaps. The key is `i ->
            # other.i2o[our[i]]`, so that we sort `our` by the order in `other`.

            # Compute upper and lower bounds on the two orders so that we don't have
            # to blindly check all pairs if the two orders are already mostly
            # sorted. If the two orders are the same in a segment from the start,
            # this will never be touched by the swaps, so we can start at the first
            # index where they differ.  Same for the end.
            i0 = 0
            while i0 < n and other.i2o[our[i0]] == other.i2o[our[i0 + 1]]:
                i0 += 1
            i1 = n - 1
            while i0 < i1 and other.i2o[our[i1 - 1]] == other.i2o[our[i1]]:
                i1 -= 1
            steps = i1 - i0 + 1

            for _ in range(steps):
                did_swap = False
                for i in range(i0, i1):
                    if other.i2o[our[i]] > other.i2o[our[i + 1]]:
                        our[i], our[i + 1] = our[i + 1], our[i]
                        index_swaps.append(i)
                        swaps.append(
                            (
                                self.get_simplex(self.i2o[our[i]]),
                                self.get_simplex(self.i2o[our[i + 1]]),
                            )
                        )
                        did_swap = True
                if not did_swap:
                    break

            return swaps, index_swaps

    def compute_transpositions_rs(
        self, other: "ordering"
    ) -> Tuple[List[Tuple[simplex, simplex]], List[int]]:
        with utils.Timed("compute_transpositions_rs"):
            our = self.list_unique_index()
            other_order = [other.i2o[s] for s in our]
            (index_swaps, simplex_pair_swaps) = mars.compute_transpositions(other_order)
            swaps = [
                (other.get_simplex(a), other.get_simplex(b))
                for (a, b) in simplex_pair_swaps
            ]
            return swaps, index_swaps
