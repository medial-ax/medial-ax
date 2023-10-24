from copy import deepcopy
import time
import math

from typing import Callable, Dict, List, Tuple
import numpy as np
import galois

import scipy as sp

from pyfiles.sneaky_matrix import SneakyMatrix

from . import complex as cplx
from . import matrix as mat
from . import plot as ourplot
from . import utils
from . import grid

GF2 = galois.GF(2)


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
        return f"hello i am a vineyard"

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

        def nth_complex(i: int) -> cplx.complex:
            return pair_of_grapes[0][i]

        def nth_matrix(i: int) -> mat.bdmatrix:
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

        def nth_matrix(i: int) -> mat.bdmatrix:
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


def matrix_inverse(mat: np.ndarray) -> np.ndarray:
    """Returns the inverse of the matrix in Z/2Z."""
    # NOTE: this is probably broken.
    print("DONT USE THIS, ITS BROKEN")
    return np.absolute(np.linalg.inv(mat).astype(int)) % 2


# def sparse_matrix_inverse(mat: sp.sparse.sparray) -> sp.sparse.sparray:
#     """Returns the inverse of the matrix in Z/2Z."""
#     inv = sp.sparse.linalg.inv(mat)
#     inv.data %= 2
#     inv.data = np.absolute(inv.data)
#     return inv.astype(int)


def permutation_matrix(n: int, i: int, j: int) -> np.ndarray:
    P = np.eye(n, dtype=int)
    P[:, [i, j]] = P[:, [j, i]]
    return P


def make_permutation_fn(i: int, j: int) -> Callable[[np.ndarray], np.ndarray]:
    """
    Alternative to `permutation_matrix` that doesn't involve making a whole
    matrix just to swap around some columns.
    """

    def inner(A):
        with utils.Timed("permutation_fn"):
            A[[i, j]] = A[[j, i]]
            A[:, [i, j]] = A[:, [j, i]]
            return A

    return inner


def sparse_add_row_to_row(A: sp.sparse.sparray, i: int, j: int):
    with utils.Timed("sparse_add_row_to_row"):
        # print("[r2r] A is of type", type(A))
        tmp = A[i, :] + A[j, :]
        tmp.data %= 2
        A[i, :] = tmp
        return A


def sparse_add_col_to_col(A: sp.sparse.sparray, i: int, j: int):
    with utils.Timed("sparse_add_col_to_col"):
        # print("[c2c] A is of type", type(A))
        tmp = A[:, i] + A[:, j]
        tmp.data %= 2
        A[:, i] = tmp
        return A


def is_upper_triangular(A: np.ndarray):
    rows = A.shape[0]
    for r in range(1, rows):
        for c in range(r):
            if A[r, c] == 1:
                return False
    return True


def is_probably_reduced(A: np.ndarray):
    def low(c: int) -> int:
        for i in range(A.shape[0]):
            r = (A.shape[1] - 1) - i
            if A[r, c] == 1:
                return r
        return None

    seen_ones = set()
    cols = A.shape[1]
    for c in range(cols):
        l = low(c)
        if l is not None and l in seen_ones:
            return False
        seen_ones.add(l)
    return True


def is_binary(A: np.array):
    for r in range(A.shape[0]):
        for c in range(A.shape[1]):
            if A[r, c] not in [0, 1]:
                return False
    return True


def perform_one_swap_DENSE(
    i: int,
    R: np.ndarray,
    U: np.ndarray,
):
    def gives_death(c: int) -> bool:
        for i in range(R.shape[0]):
            if R[i, c] == 1:
                return True
        return False

    def low(c: int) -> int:
        for i in range(R.shape[0]):
            r = (R.shape[1] - 1) - i
            if R[r, c] == 1:
                return r
        return None

    def low_inv(r: int) -> int:
        for c in range(R.shape[0]):
            if low(c) == r:
                return c
        return None

    gives_death_i = gives_death(i)
    gives_birth_i = not gives_death_i
    gives_death_i_1 = gives_death(i + 1)
    gives_birth_i_1 = not gives_death_i_1

    P = np.eye(R.shape[0], dtype=int)
    P[i, i] = P[i + 1, i + 1] = 0
    P[i, i + 1] = P[i + 1, i] = 1

    # Case 1: σi and σi+1 both give birth.
    if gives_birth_i and gives_birth_i_1:
        # Let U [i, i + 1] = 0, just in case.
        U[i, i + 1] = 0

        # Case 1.1: there are columns k and ℓ with low(k) = i, low(ℓ) = i +
        # 1, and R[i, ℓ] = 1.
        with utils.Timed("dumb loop here"):
            k = low_inv(i)
            l = low_inv(i + 1)
        if k != None and l != None and R[i, l] == 1:
            # Case 1.1.1: k < ℓ.
            if k < l:
                print("Case 1.1.1")
                # Add column k of PRP to column ℓ; add row ℓ of P U P to row k.

                V = np.eye(R.shape[0], dtype=int)
                V[k, l] = 1

                PRP = P @ R @ P
                PRPV = PRP @ V % 2
                # R.swap_cols_and_rows(i, i + 1)  # PRP
                # R.add_cols(l, k)  # PRPV
                assert is_probably_reduced(PRPV)

                PUP = P @ U @ P
                assert is_upper_triangular(PUP)
                VPUP = V @ PUP % 2
                assert is_upper_triangular(VPUP)
                # U_t.swap_cols_and_rows(i, i + 1)  # PUP
                # U_t.add_cols(k, l)  # VPUP

                # R.check_matrix("case 1.1.1")
                return (PRPV, VPUP, None)
            # Case 1.1.2: ℓ < k.
            if l < k:
                print("case 1.1.2")
                # Add column ℓ of P RP to column k;
                # R.swap_cols_and_rows(i, i + 1)  # PRP
                # R.add_cols(k, l)  # PRPV

                V = np.eye(R.shape[0], dtype=int)
                V[l, k] = 1

                PRP = P @ R @ P
                PRPV = PRP @ V % 2
                assert is_probably_reduced(PRPV)

                # add row k of P U P to row ℓ.
                # U_t.swap_cols_and_rows(i, i + 1)  # PUP
                # U_t.add_cols(l, k)  # VPUP
                PUP = P @ U @ P
                VPUP = V @ PUP % 2
                assert is_upper_triangular(VPUP)

                # R.check_matrix("case 1.1.2")
                # We witness a change in the pairing but NOT of Faustian type.
                return (PRPV, VPUP, False)
            raise Exception("k = l; This should never happen.")
        # Case 1.2: such columns k and ℓ do not exist.
        else:
            print("case 1.2")
            # Done.
            # PRP = P.T @ R @ P
            PRP = P @ R @ P
            # R.swap_cols_and_rows(i, i + 1)  # PRP
            # U_t.swap_cols_and_rows(i, i + 1)  # PUP
            PUP = P @ U @ P
            assert is_probably_reduced(PRP)
            assert is_upper_triangular(PUP)
            # R.check_matrix("case 1.2")
            return (PRP, PUP, None)

    # Case 2: σi and σi+1 both give death.
    if gives_death_i and gives_death_i_1:
        # Case 2.1: U [i, i + 1] = 1.
        if U[i, i + 1] == 1:
            low_i = low(i)
            low_i_1 = low(i + 1)
            # Add row i + 1 of U to row i; add column i of R to column i + 1.

            W = np.eye(R.shape[0], dtype=int)
            W[i, i + 1] = 1

            WU = W @ U % 2
            # U_t.add_cols(i, i + 1)  # W U
            # R.add_cols(i + 1, i)  # R W
            RW = R @ W % 2

            PRWP = P @ RW @ P
            # R.swap_cols_and_rows(i, i + 1)  # P R W P
            PWUP = P @ WU @ P
            # U_t.swap_cols_and_rows(i, i + 1)  # P W U P

            # Case 2.1.1: low(i) < low(i + 1).
            if low_i < low_i_1:
                print("case 2.1.1")
                assert is_probably_reduced(RW)
                assert is_probably_reduced(PRWP)
                assert is_upper_triangular(PWUP)
                # R.check_matrix("case 2.1.1")
                return (PRWP, PWUP, None)
            # Case 2.1.2: low(i + 1) < low(i).
            else:
                print("case 2.1.2")
                # Add column i of P RWP to column i + 1;
                # R.add_cols(i + 1, i)  # (P R W P) W
                PRWPW = PRWP @ W % 2
                # Add row i + 1 of P U P to row i.
                # U_t.add_cols(i, i + 1)  # W (P W U P)
                WPWUP = W @ PWUP % 2
                # We witness a NON-Faustian type change of the pairing.
                # R.check_matrix("case 2.1.2")
                assert is_probably_reduced(PRWPW)
                assert is_upper_triangular(WPWUP)
                return (PRWPW, WPWUP, False)
        # Case 2.2: U [i, i + 1] = 0.
        else:
            print("case 2.2")
            # Done.
            # R.swap_cols_and_rows(i, i + 1)  # P R P
            PRP = P @ R @ P
            # U_t.swap_cols_and_rows(i, i + 1)  # P U P
            PUP = P @ U @ P
            # R.check_matrix("case 2.2")
            assert is_probably_reduced(PRP)
            assert is_upper_triangular(PUP)
            return (PRP, PUP, None)

    # Case 3: σi gives death and σi+1 gives birth.
    if gives_death_i and gives_birth_i_1:
        # Case 3.1: U [i, i + 1] = 1.
        if U[i, i + 1] == 1:
            print("case 3.1")
            W = np.eye(R.shape[0], dtype=int)
            W[i, i + 1] = 1

            # Add row i + 1 of U to row i.
            # U_t.add_cols(i, i + 1)  # W U
            WU = W @ U % 2

            # Add column i of R to column i + 1.
            # R.add_cols(i + 1, i)  # R W
            RW = R @ W % 2

            # Furthermore, add column i of P RP to column i + 1.
            # R.swap_cols_and_rows(i, i + 1)  # P R W P
            PRWP = P @ RW @ P
            # R.add_cols(i + 1, i)  # (P R W P) W
            PRWPW = PRWP @ W % 2

            # Add row i + 1 of P U P to row i.
            # U_t.swap_cols_and_rows(i, i + 1)  # P W U P
            PWUP = P @ WU @ P
            assert is_upper_triangular(PWUP)
            # U_t.add_cols(i, i + 1)  # W (P W U P)
            WPWUP = W @ PWUP % 2

            # We witness a Faustian type change in the pairing.
            # R.check_matrix("case 3.1")
            assert is_probably_reduced(PRWPW)
            assert is_upper_triangular(WPWUP)
            return (PRWPW, WPWUP, True)
        # Case 3.2: U [i, i + 1] = 0.
        else:
            print("case 3.2")
            PRP = P @ R @ P
            # R.swap_cols_and_rows(i, i + 1)  # P R P
            # U_t.swap_cols_and_rows(i, i + 1)  # P U P
            PUP = P @ U @ P
            assert is_probably_reduced(PRP)
            assert is_upper_triangular(PUP)
            return (PRP, PUP, None)

    # Case 4: σi gives birth and σi+1 gives death.
    if gives_birth_i and gives_death_i_1:
        print("case 4")
        # Set U [i, i + 1] = 0, just in case.
        U[i, i + 1] = 0
        PRP = P @ R @ P
        PUP = P @ U @ P
        assert is_probably_reduced(PRP)
        assert is_upper_triangular(PUP)
        return (PRP, PUP, None)

    raise Exception("bottom of the function; This should never happen.")


def perform_one_swap(
    i: int,
    R: SneakyMatrix,
    U_t: SneakyMatrix,
):
    # This function performs one swap of two simplices and computes the
    # reduced matrix for the "post-swap" ordering. Notation:
    # - D, or `matrix.initmatrix`, is the incidence matrix (+ empty set)
    # - R, or `matrix.reduced`, is the reduced matrix
    # - V  records how R was reduced by doing the same column operations to
    #   the identity matrix. R = DV
    # - U is the multiplicative inverse of V.  RU = D
    # - P is the permuatation matrix that swaps the columns and rows
    #   corresponding to two simplices.  `P.T A P` performs the swap.

    # The output of this function is the new decomposition R' U' which are
    # the inputs R U but with the swaps performed, and still R being reduced
    # and U upper triangular.

    # def gives_birth(r: int) -> bool:
    #     if R.entries[r] == set():
    #         return True
    #     return any(
    #         r == max(row_numbers, default=None) for row_numbers in R.entries.values()
    #     )

    def gives_death(c: int) -> bool:
        return R.col_is_not_empty(c)

    def low(c: int) -> int:
        return R.colmax(c)

    def low_inv(r: int) -> int:
        return R.col_with_low(r)

    # gives_birth_i = gives_birth(i)
    # gives_birth_i_1 = gives_birth(i + 1)

    gives_death_i = gives_death(i)
    gives_birth_i = not gives_death_i
    gives_death_i_1 = gives_death(i + 1)
    gives_birth_i_1 = not gives_death_i_1

    # Case 1: σi and σi+1 both give birth.
    if gives_birth_i and gives_birth_i_1:
        # Let U [i, i + 1] = 0, just in case.
        U_t[i + 1, i] = 0

        # Case 1.1: there are columns k and ℓ with low(k) = i, low(ℓ) = i +
        # 1, and R[i, ℓ] = 1.
        with utils.Timed("dumb loop here"):
            k = low_inv(i)
            l = low_inv(i + 1)
        if k != None and l != None and R[i, l] == 1:
            # Case 1.1.1: k < ℓ.
            if k < l:
                # Add column k of PRP to column ℓ; add row ℓ of P U P to row k.
                R.swap_cols_and_rows(i, i + 1)  # PRP
                R.add_cols(l, k)  # PRPV

                U_t.swap_cols_and_rows(i, i + 1)  # PUP
                U_t.add_cols(k, l)  # VPUP

                R.check_matrix("case 1.1.1")
                return (R, U_t, None)
            # Case 1.1.2: ℓ < k.
            if l < k:
                # Add column ℓ of P RP to column k;
                R.swap_cols_and_rows(i, i + 1)  # PRP
                R.add_cols(k, l)  # PRPV

                # add row k of P U P to row ℓ.
                U_t.swap_cols_and_rows(i, i + 1)  # PUP
                U_t.add_cols(l, k)  # VPUP

                R.check_matrix("case 1.1.2")
                # We witness a change in the pairing but NOT of Faustian type.
                return (R, U_t, False)
            raise Exception("k = l; This should never happen.")
        # Case 1.2: such columns k and ℓ do not exist.
        else:
            # Done.
            # PRP = P.T @ R @ P
            R.swap_cols_and_rows(i, i + 1)  # PRP
            U_t.swap_cols_and_rows(i, i + 1)  # PUP
            R.check_matrix("case 1.2")
            return (R, U_t, None)

    # Case 2: σi and σi+1 both give death.
    if gives_death_i and gives_death_i_1:
        # Case 2.1: U [i, i + 1] = 1.
        if U_t[i + 1, i] == 1:
            low_i = low(i)
            low_i_1 = low(i + 1)
            # Add row i + 1 of U to row i; add column i of R to column i + 1.
            U_t.add_cols(i, i + 1)  # W U
            R.add_cols(i + 1, i)  # R W

            R.swap_cols_and_rows(i, i + 1)  # P R W P
            U_t.swap_cols_and_rows(i, i + 1)  # P W U P

            # Case 2.1.1: low(i) < low(i + 1).
            if low_i < low_i_1:
                R.check_matrix("case 2.1.1")
                return (R, U_t, None)
            # Case 2.1.2: low(i + 1) < low(i).
            else:
                # Add column i of P RWP to column i + 1;
                R.add_cols(i + 1, i)  # (P R W P) W
                # Add row i + 1 of P U P to row i.
                U_t.add_cols(i, i + 1)  # W (P W U P)
                # We witness a NON-Faustian type change of the pairing.
                R.check_matrix("case 2.1.2")
                return (R, U_t, False)
        # Case 2.2: U [i, i + 1] = 0.
        else:
            # Done.
            R.swap_cols_and_rows(i, i + 1)  # P R P
            U_t.swap_cols_and_rows(i, i + 1)  # P U P
            R.check_matrix("case 2.2")
            return (R, U_t, None)

    # Case 3: σi gives death and σi+1 gives birth.
    if gives_death_i and gives_birth_i_1:
        # Case 3.1: U [i, i + 1] = 1.
        if U_t[i + 1, i] == 1:
            # Add row i + 1 of U to row i.
            U_t.add_cols(i, i + 1)  # W U

            # Add column i of R to column i + 1.
            R.add_cols(i + 1, i)  # R W

            # Furthermore, add column i of P RP to column i + 1.
            R.swap_cols_and_rows(i, i + 1)  # P R W P
            R.add_cols(i + 1, i)  # (P R W P) W

            # Add row i + 1 of P U P to row i.
            U_t.swap_cols_and_rows(i, i + 1)  # P W U P
            U_t.add_cols(i, i + 1)  # W (P W U P)

            # We witness a Faustian type change in the pairing.
            R.check_matrix("case 3.1")
            return (R, U_t, True)
        # Case 3.2: U [i, i + 1] = 0.
        else:
            R.swap_cols_and_rows(i, i + 1)  # P R P
            U_t.swap_cols_and_rows(i, i + 1)  # P U P
            R.check_matrix("case 3.2")
            return (R, U_t, None)

    # Case 4: σi gives birth and σi+1 gives death.
    if gives_birth_i and gives_death_i_1:
        # Set U [i, i + 1] = 0, just in case.
        U_t[i + 1, i] = 0
        R.swap_cols_and_rows(i, i + 1)  # P R P
        U_t.swap_cols_and_rows(i, i + 1)  # P U P
        R.check_matrix("case 4")
        return (R, U_t, None)

    raise Exception("bottom of the function; This should never happen.")


def initialize_vineyards(
    complex: cplx.complex, a: np.ndarray
) -> Tuple[SneakyMatrix, SneakyMatrix, SneakyMatrix, cplx.ordering]:
    """
    Compute the reduced matrix of the complex from the point `a`.
    Return matrices `D`, `R`, `V`, `U_t`, for later vineyard use.
    """
    with utils.Timed("initialize_vineyards"):
        a_ordering = cplx.ordering.by_dist_to(complex, a)
        a_matrix = mat.bdmatrix.from_ordering(a_ordering)
        a_knowledge = mat.reduction_knowledge(a_matrix, a_ordering)
        a_knowledge.run()

        D = SneakyMatrix.from_dense(a_matrix.initmatrix)
        R = SneakyMatrix.from_dense(a_matrix.reduced)

        V = SneakyMatrix.eye(D.shape[0])
        for target, other in a_knowledge.adds:
            V.add_cols(target, other)
        assert (
            ((D.to_dense() @ V.to_dense()) % 2) == R.to_dense()
        ).all(), "DV should be R"

        gf_v = GF2(V.to_dense())
        gv_inv = np.linalg.inv(gf_v)
        U_t = SneakyMatrix.from_dense(gv_inv.T)
        # RU = D
        assert (
            ((R.to_dense() @ U_t.to_dense().T) % 2) == D.to_dense()
        ).all(), "RU should be D"

        # R = DV
        # RU = D
        return (D, R, U_t, a_ordering)


def vine_to_vine(
    D: SneakyMatrix,
    R: SneakyMatrix,
    U_t: SneakyMatrix,
    complex: cplx.complex,
    b: np.ndarray,
    a_ordering: cplx.ordering,
    target_dim: int,
    prune: bool = True,
) -> Tuple[bool, SneakyMatrix, SneakyMatrix, SneakyMatrix, cplx.ordering]:
    """
    Returns (found_faustian, D, R, U_t)
    """
    with utils.Timed("vine_to_vine.ordering"):
        b_ordering = cplx.ordering.by_dist_to(complex, b)

    with utils.Timed("vine_to_vine.transpositions_lean"):
        (swapped_simplices, swapped_indices) = a_ordering.compute_transpositions_lean(
            b_ordering
        )

    with utils.Timed("vine_to_vine.matrix copies"):
        R = R.copy()
        U_t = U_t.copy()
        D = D.copy()

    print("INITIAL D")
    print(D.to_dense())

    with utils.Timed("vine_to_vine.loop"):
        bad_point = None
        found_faustian = False
        # print(f"swapped_indices = #{len(swapped_indices)}")
        for swap_i, i in enumerate(swapped_indices):
            with utils.Timed("perform_one_swap"):
                (_, _, faustian_swap) = perform_one_swap(i, R, U_t)
            D.swap_cols_and_rows(i, i + 1)
            print("i=", i)
            print(D.to_dense())
            with utils.Timed("RU=D check"):
                RU = (R.to_dense() @ U_t.to_dense().T) % 2
                if not (RU == D.to_dense()).all():
                    print("==================================================")
                    assert False
                    print("i=", i)
                    print("R\n", R.to_dense())
                    print("U\n", U_t.to_dense().T)
                    print("RU\n", RU)
                    print("D\n", D.to_dense())
                    assert False

            if faustian_swap:
                s1, s2 = swapped_simplices[swap_i]

                # Pruning
                # If we get two vertices that share an edge, skip the swap.
                skip = False
                if prune and s1.dim() == 0 and s2.dim() == 0:
                    cob1 = set(complex.get_coboundary(s1))
                    cob2 = set(complex.get_coboundary(s2))
                    if cob1 & cob2:
                        skip = True

                if not skip and s1.dim() == target_dim and s2.dim() == target_dim:
                    found_faustian = True

                if not skip and s1.dim() != s2.dim():
                    print(f"This should not happen: {s1.dim()} != {s2.dim()}")
                    bad_point = b
                    print(s1)
                    print(s2)
                    print(b)
                    # assert False, f"This should not happen: {s1.dim()} != {s2.dim()}"

        return (found_faustian, D, R, U_t, b_ordering, bad_point)


def initialize_vineyards_DENSE(
    complex: cplx.complex, a: np.ndarray
) -> Tuple[SneakyMatrix, SneakyMatrix, SneakyMatrix, cplx.ordering]:
    """
    Compute the reduced matrix of the complex from the point `a`.
    Return matrices `D`, `R`, `V`, `U_t`, for later vineyard use.
    """
    with utils.Timed("initialize_vineyards"):
        a_ordering = cplx.ordering.by_dist_to(complex, a)
        a_matrix = mat.bdmatrix.from_ordering(a_ordering)
        a_knowledge = mat.reduction_knowledge(a_matrix, a_ordering)
        a_knowledge.run()

        D = a_matrix.initmatrix
        R = a_matrix.reduced

        V = np.eye(D.shape[0], dtype=int)
        for target, other in a_knowledge.adds:
            V[:, target] = (V[:, target] + V[:, other]) % 2
        assert ((D @ V % 2) == R).all(), "DV should be R"

        gf_v = GF2(V)
        gv_inv = np.linalg.inv(gf_v)
        U = np.array(gv_inv)
        # RU = D
        assert ((R @ U % 2) == D).all(), "RU should be D"

        # R = DV
        # RU = D
        return (D, R, U, a_ordering)


def vine_to_vine_DENSE(
    D: np.ndarray,
    R: np.ndarray,
    U: np.ndarray,
    complex: cplx.complex,
    b: np.ndarray,
    a_ordering: cplx.ordering,
    target_dim: int,
    prune: bool = True,
) -> Tuple[bool, SneakyMatrix, SneakyMatrix, SneakyMatrix, cplx.ordering]:
    """
    Returns (found_faustian, D, R, U_t)
    """
    with utils.Timed("vine_to_vine.ordering"):
        b_ordering = cplx.ordering.by_dist_to(complex, b)

    with utils.Timed("vine_to_vine.transpositions_lean"):
        (swapped_simplices, swapped_indices) = a_ordering.compute_transpositions_lean(
            b_ordering
        )

    with utils.Timed("vine_to_vine.loop"):
        bad_point = None
        found_faustian = False
        for swap_i, i in enumerate(swapped_indices):
            with utils.Timed("perform_one_swap"):
                (newR, newU, faustian_swap) = perform_one_swap_DENSE(i, R, U)

            assert is_binary(newR)
            assert is_binary(newU)

            P = np.eye(R.shape[0], dtype=int)
            P[i, i] = P[i + 1, i + 1] = 0
            P[i, i + 1] = P[i + 1, i] = 1

            PDP = P @ D @ P
            print(f"i={i} ({swap_i}")
            print(PDP)

            with utils.Timed("RU=D check"):
                newRnewU = (newR @ newU) % 2
                if not (newRnewU == PDP).all():
                    print("i=", i)
                    print("R\n", newR)
                    print("U\n", newU)
                    print("RU\n", newRnewU)
                    print("D\n", PDP)
                    assert False

            R = newR
            U = newU
            D = PDP

            if faustian_swap:
                s1, s2 = swapped_simplices[swap_i]

                # Pruning
                # If we get two vertices that share an edge, skip the swap.
                skip = False
                if prune and s1.dim() == 0 and s2.dim() == 0:
                    cob1 = set(complex.get_coboundary(s1))
                    cob2 = set(complex.get_coboundary(s2))
                    if cob1 & cob2:
                        skip = True

                if not skip and s1.dim() == target_dim and s2.dim() == target_dim:
                    found_faustian = True

                if not skip and s1.dim() != s2.dim():
                    print(f"This should not happen: {s1.dim()} != {s2.dim()}")
                    bad_point = b
                    print(s1)
                    print(s2)
                    print(b)
                    # assert False, f"This should not happen: {s1.dim()} != {s2.dim()}"

        return (found_faustian, D, R, U, b_ordering, bad_point)
