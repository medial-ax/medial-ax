from typing import List
from classes_loop import simplex

from scipy.spatial import distance


def augment_with_radialdist(complex: complex):
    ret = []
    for s in complex.vertlist:
        # This has to be the squared euclidean distance, and not just the regular one.
        dist = distance.sqeuclidean(complex.key_point, s.coords)
        s.radialdist = dist
        ret.append(dist)
    return ret


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
            if s.dim == 0:
                return (distlist[s.index], 0)
            elif s.dim == 1:
                return (max([distlist[i] for i in s.boundary]), 1)
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
