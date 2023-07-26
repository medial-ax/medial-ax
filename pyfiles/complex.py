from typing import List

from scipy.spatial import distance


def augment_with_radialdist(complex: complex):
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
        """Create a new edge simplex with given coordinates and index."""
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
        # here we initialize everything. if defining an attribute with a function, must init func first.
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

    def __repr__(self):
        # IN PROGRESS
        # f strings are easy way to turn things into strings
        return f"simplex ind {self.index}, dim {self.dim()}, bd {self.boundary}, col val {self.columnvalue}"
        # usage: print(rect), where rect is a Rectangle


class complex:
    vertlist: List[simplex]
    edgelist: List[simplex]
    key_point: List[float]

    def __init__(self):
        # seems like it's fine to have lists as long as they're not parameters of the class
        # otherwise, they're shared by the whole class and that is no
        self.edgelist = []
        self.vertlist = []
        self.key_point = [0.0, 0.0]

    def __repr__(self):
        return f"number of verts is {self.nverts()}, and number of edges is {self.nedges()} 2"

    def nedges(self):
        return len(self.edgelist)

    def nverts(self):
        return len(self.vertlist)

    def sort_by_dist(self, distlist):
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
