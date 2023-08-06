from copy import deepcopy
import time
import math

from typing import Callable, List, int
import numpy as np

import complex as cplx
import matrix as mat
from pyfiles.matrix import bdmatrix


class vineyard:
    pointset: np.ndarray
    complexlist: List[cplx.complex]
    matrixlist: List[mat.bdmatrix]
    keypointlist: List[List[float]]
    grape: str

    def __init__(self):
        self.pointset = np.empty(2)
        self.complexlist = []
        self.matrixlist = []
        self.keypointlist = []
        self.grape = "-888o"
        # lows and zeros are stored in a bdmatrix

    def __repr__(self):
        # IN PROGRESS
        # f strings are easy way to turn things into strings
        return f"hello i am a vineyard"
        # usage: print(vin), where vin is a vineyard

    def add_complex(
        self,
        complex: cplx.complex,
        key_point: np.ndarray,
        show_details=True,
        timethings=False,
    ):
        """
        This function assumes that the complex passed in is not passed to it again.
        We store ordering info there, so if
        """
        s_complex = deepcopy(complex)
        s_complex.key_point = key_point

        if timethings:
            start_time = time.perf_counter()
        # update this to .self so don't need input, except maybe key pt
        distlist = cplx.augment_with_radialdist(s_complex)

        all_simplices = s_complex.sort_by_dist(distlist)
        # if (key_point == [0.5, 1]).all():
        #   print("heellloooo", all_simplices[0], all_simplices[0].coords, "keypt", key_point)
        #   print(points)

        # I am pretty sure the simps are also ordered in s_complex,
        # not just all_simplices.
        if timethings:
            print(
                f"It took {time.perf_counter() - start_time :.3f} sec to sort the complex {len(self.complexlist)}"
            )

        matrix = mat.bdmatrix()
        # assign simplices to matrix columns
        matrix.make_matrix(s_complex)

        if timethings:
            start_time = time.perf_counter()
        matrix.redmatrix = matrix.reduce()
        if timethings:
            print(
                f"It took {time.perf_counter() - start_time :.3f} sec to smartreduce the matrix {len(self.matrixlist)}"
            )

        # this adds in a column for reduced homology
        if timethings:
            start_time = time.perf_counter()
        matrix.add_dummy_col()
        # find the (r,c) vales of lowest ones in the matrix,
        # and also identify zero columns
        matrix.find_lows_zeros(all_simplices, output=False)

        betti_dummy, betti_zero, betti_one = matrix.find_bettis()
        matrix.find_bd_pairs(output=show_details)
        if timethings:
            print(f"It took {time.perf_counter() - start_time :.3f} sec to find bettis")

        if show_details:
            print("\n")
            for key, value in matrix.bd_pairs.items():
                print(key, ":", value)

        # add to vineyard
        self.complexlist.append(s_complex)
        self.matrixlist.append(matrix)
        self.keypointlist.append(key_point)
        if timethings:
            print("\n")

    def is_knee(self, int_one, int_two, eps=1, printout=False):
        # there may be more things we need to update if the ints are not 0 and 1

        # if it's an i-dimensional homology class, the birth simplex has dim i I
        # am not sure the death simplex is guaranteed to be dim i+1, so we might
        # not have store enough info earlier to look it up, as index is not
        # unique without dimension

        # find the verts that kill the empty set we can cheat a little on
        # finding these types of knees, because there's always exactly one vert
        # that kills the empty set if the complex is nonempty, and all the
        # others give birth to 0 homology, so instead of looking for cross
        # dimensional birth death switches as such, we can look just for the
        # death of the empty simplex.

        # now that there are no triangles, we are looking at top-dimensional,
        # ie, unpaired, simplices (edges) instead of birth-death pairs. this
        # will need to be made more robust when we add triangles.

        pair_of_grapes = [
            [self.complexlist[0], self.complexlist[1]],
            [self.matrixlist[0], self.matrixlist[1]],
        ]

        def nth_complex(i: int) -> complex:
            return pair_of_grapes[0][i]

        def nth_matrix(i: int) -> bdmatrix:
            return pair_of_grapes[1][i]

        pair_of_deaths = []
        dims_of_deaths = []
        pair_of_unpaired = []

        # a knee involves two dims, a d dim death and a d + 1 birth. we refer to
        # a knee by the lower (death) dimension.
        is_emptyset_knee = False
        is_zero_knee = False

        for i in range(len(pair_of_grapes)):
            # one grape is one complex
            # all complexes have same underlying set, but different special point
            deaths = nth_matrix(i).bd_pairs["death"]
            dims = nth_matrix(i).bd_pairs["classdim"]
            for j in range(len(deaths)):
                # find the exactly one death of the empty simplex
                if dims[j] == -1:
                    pair_of_deaths.append(deaths[j])

        if printout:
            print("verts that killed the empy set: \n", pair_of_deaths)

        # note, we are already referring to the simplices by their index, which
        # was the initial parametric sampling, so they are in order so we can
        # use this number to find nearest neighbor relationship
        epsilon = eps

        # range is inclusive on left and excl on right, so need +1
        if pair_of_deaths[0] not in range(
            pair_of_deaths[1] - epsilon, pair_of_deaths[1] + epsilon + 1
        ):
            # print("I am death", pair_of_deaths[0])
            if printout:
                print(
                    "type 3 knee between key points",
                    nth_complex(0).key_point,
                    "and",
                    nth_complex(1).key_point,
                    "\n( with epsilon nbhd of",
                    epsilon,
                    ")\n-----",
                )
            is_emptyset_knee = True

        else:
            if printout:
                print(
                    "no type 3 knee for zero-homology",
                    "(with epsilon nbhd of",
                    epsilon,
                    ")\n-----",
                )

        # Now that there are no triangles, we are looking at top-dimensional,
        # ie, unpaired, simplices (edges) instead of birth-death pairs. this
        # will need to be made more robust when we add triangles.

        # TODO(#5): this seems related, though not exactly the closed loop assumption.

        for i in range(len(pair_of_grapes)):
            # one grape is one complex
            # all complexes have same underlying set, but different special point
            one_d_births = nth_matrix(i).unpaired["birth"]
            dims = nth_matrix(i).unpaired["classdim"]
            for j in range(len(one_d_births)):
                # find the exactly one death of the empty simplex
                if dims[j] == 1:
                    pair_of_unpaired.append(one_d_births[j])

        if printout:
            print("\nedges that birthed one-homology:\n", pair_of_unpaired)

        if pair_of_unpaired[0] not in range(
            pair_of_unpaired[1] - epsilon, pair_of_unpaired[1] + epsilon + 1
        ):
            if printout:
                print(
                    "type 3 knee between key points",
                    nth_complex(0).key_point,
                    "and",
                    nth_complex(1).key_point,
                    "\n( with epsilon nbhd of",
                    epsilon,
                    ")",
                )

            is_zero_knee = True
        else:
            if printout:
                print(
                    "no type 3 knee for one-homology",
                    "(with epsilon nbhd of",
                    epsilon,
                    ")",
                )

        return is_emptyset_knee, is_zero_knee, epsilon

    def is_dist_knee(
        self,
        int_one,
        int_two,
        point1: np.ndarray,
        point2: np.ndarray,
        eps=1,
        printout=False,
    ):
        # This is mostly a copy of `vineyard.is_knee`.

        pair_of_grapes = [
            [self.complexlist[0], self.complexlist[1]],
            [self.matrixlist[0], self.matrixlist[1]],
        ]

        def nth_complex(i: int) -> complex:
            return pair_of_grapes[0][i]

        def nth_matrix(i: int) -> bdmatrix:
            return pair_of_grapes[1][i]

        pair_of_deaths = []
        dims_of_deaths = []
        pair_of_unpaired = []

        is_emptyset_knee = False
        is_zero_knee = False

        for i in range(len(pair_of_grapes)):
            deaths = nth_matrix(i).bd_pairs["death"]
            dims = nth_matrix(i).bd_pairs["classdim"]
            for j in range(len(deaths)):
                if dims[j] == -1:
                    pair_of_deaths.append(deaths[j])

        if printout:
            print("verts that killed the empy set: \n", pair_of_deaths)

        epsilon = eps

        # range is inclusive on left and excl on right, so need +1 if the dist
        # between simps on input object is smaller than dist between comparison
        # points on grid print(pair_of_deaths[0]) need a function to look up,
        # given a vertex by index in complex 0 and complex 1, the corresponding
        # simplex coords

        # print(self.complexlist[0])
        for i in range(len(self.complexlist[0].vertlist)):
            if pair_of_deaths[0] == self.complexlist[0].vertlist[i].index:
                deathcoords0 = self.complexlist[0].vertlist[i].coords
            if pair_of_deaths[1] == self.complexlist[1].vertlist[i].index:
                deathcoords1 = self.complexlist[1].vertlist[i].coords

        if math.dist(point1, point2) * epsilon < math.dist(deathcoords0, deathcoords1):
            # print("I am death", pair_of_deaths[0])
            if printout:
                print(
                    "type 3 knee between key points",
                    pair_of_grapes[0][0].key_point,
                    "and",
                    pair_of_grapes[0][1].key_point,
                    "\n( with epsilon nbhd of",
                    epsilon,
                    ")\n-----",
                )
            is_emptyset_knee = True

        else:
            if printout:
                print(
                    "no type 3 knee for zero-homology",
                    "(with epsilon nbhd of",
                    epsilon,
                    ")\n-----",
                )

        for i in range(len(pair_of_grapes)):
            one_d_births = nth_matrix(i).unpaired["birth"]
            dims = nth_matrix(i).unpaired["classdim"]
            for j in range(len(one_d_births)):
                # find the exactly one death of the empty simplex
                if dims[j] == 1:
                    pair_of_unpaired.append(one_d_births[j])

        # I THINK this extracts the coordinates of the the unpaired things. It
        # is slower than it needs to be though. DESPERATELY NEED LOOKUP
        # FUNCTIONS SO NO HORRIBLE FOR LOOPS.
        for i in range(len(self.complexlist[0].edgelist)):
            if pair_of_unpaired[0] == self.complexlist[0].edgelist[i].index:
                ind0 = self.complexlist[0].edgelist[i].boundary[0]
                for j in range(len(self.complexlist[0].vertlist)):
                    if ind0 == self.complexlist[0].vertlist[j].index:
                        unpairedcoords0 = self.complexlist[0].vertlist[j].coords

            if pair_of_unpaired[1] == self.complexlist[1].edgelist[i].index:
                ind1 = self.complexlist[1].edgelist[i].boundary[0]
                for j in range(len(self.complexlist[1].vertlist)):
                    if ind1 == self.complexlist[1].vertlist[j].index:
                        unpairedcoords1 = self.complexlist[1].vertlist[j].coords

        if printout:
            print("\nedges that birthed one-homology:\n", pair_of_unpaired)

        if math.dist(point1, point2) * epsilon < math.dist(
            unpairedcoords0, unpairedcoords1
        ):
            if printout:
                print(
                    "type 3 knee between key points",
                    pair_of_grapes[0][0].key_point,
                    "and",
                    pair_of_grapes[0][1].key_point,
                    "\n( with epsilon nbhd of",
                    epsilon,
                    ")",
                )

            is_zero_knee = True
        else:
            if printout:
                print(
                    "no type 3 knee for one-homology",
                    "(with epsilon nbhd of",
                    epsilon,
                    ")",
                )

        return is_emptyset_knee, is_zero_knee, epsilon
