from copy import deepcopy
import time
import math

from typing import Callable, Dict, List
import numpy as np

from . import complex as cplx
from . import matrix as mat
from . import plot as ourplot
from . import utils as utils


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
    return np.absolute(np.linalg.inv(mat).astype(int)) % 2


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
        A[[i, j]] = A[[j, i]]
        A[:, [i, j]] = A[:, [j, i]]
        return A

    return inner


def perform_one_swap(
    i: int,
    rk: mat.reduction_knowledge,
    R: np.ndarray,
    U: np.ndarray,
    index_map: Dict[int, int],
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

    # P is the permutation matrix that swaps the things
    # NOTE: this swaps COLUMN `swap_index` with `swap_index + 1`
    # P = permutation_matrix(R.shape[0], i, i + 1)
    Pfn = make_permutation_fn(i, i + 1)

    # Case 1: σi and σi+1 both give birth.
    if rk.gives_birth(index_map[i]) and rk.gives_birth(index_map[i + 1]):
        # Let U [i, i + 1] = 0, just in case.
        _U = U.copy()
        _U[i, i + 1] = 0

        # Case 1.1: there are columns k and ℓ with low(k) = i, low(ℓ) = i +
        # 1, and R[i, ℓ] = 1.
        k = rk.birth_death_pairs[index_map[i]]
        l = rk.birth_death_pairs[index_map[i + 1]]
        if k != -1 and l != -1 and R[i, l] == 1:
            # Case 1.1.1: k < ℓ.
            if k < l:
                # Add column k of PRP to column ℓ; add row ℓ of P U P to row k.
                # PRP = P.T @ R @ P
                PRP = Pfn(R)
                PRP[:, l] = (PRP[:, k] + PRP[:, l]) % 2

                # PUP = P.T @ _U @ P
                PUP = Pfn(_U)
                PUP[k, :] = (PUP[k, :] + PUP[l, :]) % 2

                return (PRP, PUP, None)
            # Case 1.1.2: ℓ < k.
            if l < k:
                # Add column ℓ of P RP to column k;
                # PRP = P.T @ R @ P
                PRP = Pfn(R)
                PRP[:, k] = (PRP[:, k] + PRP[:, l]) % 2

                # add row k of P U P to row ℓ.
                # PUP = P.T @ _U @ P
                PUP = Pfn(_U)
                PUP[l, :] = (PUP[k, :] + PUP[l, :]) % 2

                # We witness a change in the pairing but NOT of Faustian type.
                return (PRP, PUP, False)
        # Case 1.2: such columns k and ℓ do not exist.
        else:
            # Done.
            # PRP = P.T @ R @ P
            PRP = Pfn(R)
            # PUP = P.T @ _U @ P
            PUP = Pfn(_U)
            return (PRP, PUP, None)

    # Case 2: σi and σi+1 both give death.
    if rk.gives_death(index_map[i]) and rk.gives_death(index_map[i + 1]):
        # Case 2.1: U [i, i + 1] = 1.
        if U[i, i + 1] == 1:
            # Add row i + 1 of U to row i; add column i of R to column i + 1.
            _U = U.copy()
            _U[i, :] = (_U[i, :] + _U[i + 1, :]) % 2
            _R = R.copy()
            _R[:, i + 1] = (_R[:, i] + _R[:, i + 1]) % 2

            # Case 2.1.1: low(i) < low(i + 1).
            if rk.low(i) < rk.low(i + 1):
                # PRP = P.T @ _R @ P
                PRP = Pfn(_R)
                # PUP = P.T @ _U @ P
                PUP = Pfn(_U)
                return (PRP, PUP, None)
            # Case 2.1.2: low(i + 1) < low(i).
            else:
                # Add column i of P RP to column i + 1;
                # PRP = P.T @ _R @ P
                PRP = Pfn(_R)
                PRP[:, i + 1] = (PRP[:, i] + PRP[:, i + 1]) % 2
                # Add row i + 1 of P U P to row i.
                # PUP = P.T @ _U @ P
                PUP = Pfn(_U)
                PUP[i, :] = (PUP[i, :] + PUP[i + 1, :]) % 2
                # We witness a NON-Faustian type change of the pairing.
                return (PRP, PUP, False)
        # Case 2.2: U [i, i + 1] = 0.
        else:
            # Done.
            # PRP = P.T @ R @ P
            PRP = Pfn(R)
            # PUP = P.T @ U @ P
            PUP = Pfn(U)
            return (PRP, PUP, None)

    # Case 3: σi gives death and σi+1 gives birth.
    if rk.gives_death(index_map[i]) and rk.gives_birth(index_map[i + 1]):
        # Case 3.1: U [i, i + 1] = 1.
        if U[i, i + 1] == 1:
            # Add row i + 1 of U to row i.
            _U = U.copy()
            _U[i, :] = (_U[i, :] + _U[i + 1, :]) % 2

            # Add column i of R to column i + 1.
            _R = R.copy()
            _R[:, i + 1] = (_R[:, i] + _R[:, i + 1]) % 2

            # Furthermore, add column i of P RP to column i + 1.
            # PRP = P.T @ _R @ P
            PRP = Pfn(_R)
            PRP[:, i + 1] = (PRP[:, i] + PRP[:, i + 1]) % 2

            # Add row i + 1 of P U P to row i.
            # PUP = P.T @ _U @ P
            PUP = Pfn(_U)
            PUP[i, :] = (PUP[i, :] + PUP[i + 1, :]) % 2
            # print(
            #     f"faustian: dim of simplexes {rk.ordering.get_simplex(index_map[i]).dim()}/{rk.ordering.get_simplex(index_map[i+1]).dim()}"
            # )

            # We witness a Faustian type change in the pairing.
            return (PRP, PUP, True)
        # Case 3.2: U [i, i + 1] = 0.
        else:
            # PRP = P.T @ R @ P
            PRP = Pfn(R)
            # PUP = P.T @ U @ P
            PUP = Pfn(U)
            return (PRP, PUP, None)

    # Case 4: σi gives birth and σi+1 gives death.
    if rk.gives_birth(index_map[i]) and rk.gives_death(index_map[i + 1]):
        # Set U [i, i + 1] = 0, just in case.
        _U = U.copy()
        _U[i, i + 1] = 0
        # PRP = P.T @ R @ P
        PRP = Pfn(R)
        # PUP = P.T @ _U @ P
        PUP = Pfn(_U)
        return (PRP, PUP, None)


def do_vineyards_for_two_points(
    complex: cplx.complex, a: np.ndarray, b: np.ndarray, target_dim: int
):
    """Run the vineyards algorithm for two points. Fully reduce the matrix for the first point."""

    debug_yes = (
        np.linalg.norm(a - np.array([0.6, 0.2])) < 0.0001
        and np.linalg.norm(b - np.array([0.6, 0.4])) < 0.0001
    )
    with utils.Timed("vineyard from scratch"):
        a_ordering = cplx.ordering.by_dist_to(complex, a)
        a_matrix = mat.bdmatrix.from_ordering(a_ordering)
        a_knowledge = mat.reduction_knowledge(a_matrix, a_ordering)
        a_knowledge.run()

    # R = DV
    D = a_matrix.initmatrix
    R = a_matrix.reduced

    with utils.Timed("create V"):
        V = np.eye(D.shape[0], dtype=int)
        for target, other in a_knowledge.adds:
            V[:, target] = (V[:, target] + V[:, other]) % 2
        assert (
            ((D @ V) % 2) == R
        ).all(), "Something is wrong with the column reduction"

    with utils.Timed("create U"):
        # RU = D
        U = matrix_inverse(V)
        assert (
            ((R @ U) % 2) == D
        ).all(), "Something is wrong with the column reduction"

    with utils.Timed("create B"):
        b_ordering = cplx.ordering.by_dist_to(complex, b)

    with utils.Timed("compute_transpositions"):
        (swapped_simplices, _, swapped_indices) = a_ordering.compute_transpositions(
            b_ordering
        )

    # if yes:
    #     ourplot.plot_orders_with_bubbles(a_ordering, b_ordering)

    # Make a map that we can use to map "swapped indices" to the indices that we can use in `a_knowledge`.
    # That is, inside `perform_one_swap` we want to map the "swapped" indices to their original indices.
    # The map starts as identity. After these swaps [(3,4), (2,3)] the map should be
    #   { 0: 0,  1: 1,  2: 2,  3: 3,  4: 4,  5: 5,  6: 6}   (id)
    #   { 0: 0,  1: 1,  2: 2,  3: 4,  4: 3,  5: 5,  6: 6}   (after (3,4))
    #   { 0: 0,  1: 1,  2: 4,  3: 2,  4: 3,  5: 5,  6: 6}   (after (2,3))
    #
    # The operation we want is to map indices from the updated matrix to the original matrix,
    # so that we can ask `a_knowledge` about the simplices that we're looking at in the updated matrix.
    # For instance, after a few swaps we might be interested in the dimension of the simplex that is
    # at index 2.  This is how the permutations look, and how we want to map them:
    #
    # .  0 . 1 . 2 . 3 . 4 . 5 . 6      (index)
    # -----------------------------------------
    # .  a . b . c . d . e . f . g      (id)
    # .  a . b . c . e . d . f . g      (after (3,4))
    # .  a . b . e . c . d . f . g      (after (2,3))
    # .          ^ . (want to map 2 ---> 4)
    index_map = dict({i: i for i in range(a_matrix.initmatrix.shape[0])})

    found_faustian = False
    tricksy_different_dim = False
    # print(f"swapped_indices = #{len(swapped_indices)}")
    with utils.Timed("do swaps"):
        for swap_i, i in enumerate(swapped_indices):
            P = permutation_matrix(R.shape[0], i, i + 1)
            PDP = (P.T @ D @ P) % 2
            (RR, UU, faustian_swap) = perform_one_swap(i, a_knowledge, R, U, index_map)
            index_map[i], index_map[i + 1] = (
                index_map[i + 1],
                index_map[i],
            )

            if faustian_swap:
                s1, s2 = swapped_simplices[swap_i]
                # TODO: double check that this is actually the correct check for figuring out if we're on the MA.
                # TODO: Mabye these are always the same?
                if debug_yes:
                    print(s1.dim(), s1, s2)

                skip = False
                if s1.dim() == 0 and s2.dim() == 0:
                    cob1 = set(complex.get_coboundary(s1))
                    cob2 = set(complex.get_coboundary(s2))
                    if cob1 & cob2:
                        skip = True

                if not skip and s1.dim() == target_dim and s2.dim() == target_dim:
                    found_faustian = True

                if not skip and s1.dim() != s2.dim():
                    print(f"This should not happen: {s1.dim()} != {s2.dim()}")
                    tricksy_different_dim = True

            RRUU = (RR @ UU) % 2
            # assert (RRUU == PDP).all(), "Something is wrong with the column reduction"
            R = RR
            U = UU
            D = PDP

    return found_faustian, tricksy_different_dim
