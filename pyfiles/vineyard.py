from copy import deepcopy
import time
from typing import List
import numpy as np

import complex as cplx
import matrix as mat


class vineyard:
    pointset: np.array
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
        key_point,
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
        self.pointset = points
        self.complexlist.append(s_complex)
        self.matrixlist.append(matrix)
        self.keypointlist.append(key_point)
        if timethings:
            print("\n")
