from collections import defaultdict
from copy import deepcopy
from dataclasses import dataclass
from enum import Enum
import time
import math

from typing import Callable, DefaultDict, Dict, List, Tuple, Type
import numpy as np
import galois

import scipy as sp

from pyfiles.sneaky_matrix import SneakyMatrix

from . import complex as cplx
from . import matrix as mat
from . import plot as ourplot
from . import utils
from . import grid
from mars import SneakyMatrix as SM, vine_to_vine as SM_vine_to_vine
import mars

GF2 = galois.GF(2)


def is_upper_triangular(A: np.ndarray):
    """Checks if the matrix is upper triangular."""
    rows = A.shape[0]
    for r in range(1, rows):
        for c in range(r):
            if A[r, c] == 1:
                return False
    return True


def is_probably_reduced(A: np.ndarray):
    """Checks if the matrix is reduced. We think this is sufficient, but we're not sure."""

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
    """Check that a matrix is binary, i.e. all entries are 0 or 1."""
    for r in range(A.shape[0]):
        for c in range(A.shape[1]):
            if A[r, c] not in [0, 1]:
                return False
    return True


def prnt(A: np.array, label: None | str = None):
    """Prints a matrix with 0s replaced by spaces. Optionally, add a `label`."""
    if label:
        print(label)
    print(str(A).replace("0", " "))
    print()


def find_killer(simplex: cplx.simplex, ordering: cplx.ordering, R: SM | SneakyMatrix):
    """
    Finds the killer simplex of the given simplex. If there's no killer, return
    None.
    """
    r = ordering.matrix_index(simplex)
    if isinstance(R, SneakyMatrix):
        c = R.col_with_low(r)
    else:
        c = R.col_with_low(r)
    if c is None:
        return None
    simplex = ordering.get_simplex(c)
    return simplex


def compute_persistence(
    simplex: cplx.simplex, ordering: cplx.ordering, R: SM | SneakyMatrix
):
    time_birth = ordering.get_entrance_value(simplex)
    killer = find_killer(simplex, ordering, R)
    if killer is None:
        return 234567890
    time_death = ordering.get_entrance_value(killer)
    time_alive = time_death - time_birth
    return time_alive


class Version(Enum):
    Sparse = "sparse"
    Dense = "dense"
    RS = "rs"


@dataclass
class sparse_reduction_state:
    """The full state of a sparse reduction, computed with sparse data structures."""

    D: SneakyMatrix
    """The boundary matrix D"""
    R: SneakyMatrix
    """The reduced matrix R"""
    U_t: SneakyMatrix
    """The transpose of the inverse matrix U"""
    ordering: cplx.ordering
    """The ordering of the simplices from the point from which the reduction was computed."""
    point: np.array
    """The point from which the reduction was computed."""
    complex: cplx.complex
    """The complex"""


@dataclass
class dense_reduction_state:
    """The full state of a dense reduction, computed with dense data structures."""

    D: np.ndarray
    """The boundary matrix D. RU = D"""
    R: np.ndarray
    """The reduced matrix R. D = DV"""
    U: np.ndarray
    """The inverse matrix U of V. RU = D"""
    ordering: cplx.ordering
    """The ordering of the simplices from the point from which the reduction was computed."""
    point: np.array
    """The point from which the reduction was computed."""
    complex: cplx.complex
    """The complex"""


@dataclass
class rs_reduction_state:
    """The full state of a sparse reduction, computed with sparse data structures."""

    D: SM
    """The boundary matrix D"""
    R: SM
    """The reduced matrix R"""
    U_t: SM
    """The transpose of the inverse matrix U"""
    ordering: cplx.ordering
    """The ordering of the simplices from the point from which the reduction was computed."""
    point: np.array
    """The point from which the reduction was computed."""
    complex: cplx.complex
    """The complex"""


class vineyard:
    complex: cplx.complex

    state_map: DefaultDict
    reduced_states: List[sparse_reduction_state | dense_reduction_state]

    num_swaps: int
    """The number of swaps performed in the reduction."""
    swap_counts: List[int]

    def __init__(self, complex: cplx.complex):
        self.complex = complex
        self.reduced_states = []
        self.state_map = defaultdict(list)
        self.num_swaps = 0
        self.swap_counts = []

    def reduce(
        self, point: np.ndarray, version: Version = "RS", asserts=False
    ) -> sparse_reduction_state | dense_reduction_state:
        """
        Compute the reduced matrix of the complex from the point `point`.
        """
        if version == "dense":
            with utils.Timed("initialize_vineyards"):
                a_ordering = cplx.ordering.by_dist_to(self.complex, point)
                a_matrix = mat.bdmatrix.from_ordering(a_ordering)
                a_knowledge = mat.reduction_knowledge(a_matrix, a_ordering)
                a_knowledge.run()

                D = a_matrix.initmatrix
                R = a_matrix.reduced

                V = np.eye(D.shape[0], dtype=int)
                for target, other in a_knowledge.adds:
                    V[:, target] = (V[:, target] + V[:, other]) % 2
                if asserts:
                    assert ((D @ V % 2) == R).all(), "DV should be R"

                gf_v = GF2(V)
                gv_inv = np.linalg.inv(gf_v)
                U = np.array(gv_inv)
                # RU = D
                if asserts:
                    assert ((R @ U % 2) == D).all(), "RU should be D"
                # R = DV
                # RU = D
                state = dense_reduction_state(D, R, U, a_ordering, point, self.complex)
        else:
            # No matter if we're doing RS or sparse, let's just do sparse.
            with utils.Timed("reduce sparse"):
                a_ordering = cplx.ordering.by_dist_to(self.complex, point)
                a_matrix = mat.bdmatrix.from_ordering(a_ordering)
                a_knowledge = mat.reduction_knowledge(a_matrix, a_ordering)
                a_knowledge.run()

                D = SneakyMatrix.from_dense(a_matrix.initmatrix)
                R = SneakyMatrix.from_dense(a_matrix.reduced)

                V = SneakyMatrix.eye(D.shape[1])
                for target, other in a_knowledge.adds:
                    V.add_cols(target, other)
                if asserts:
                    assert (
                        ((D.to_dense() @ V.to_dense()) % 2) == R.to_dense()
                    ).all(), "DV should be R"

                gf_v = GF2(V.to_dense())
                gv_inv = np.linalg.inv(gf_v)
                U_t = SneakyMatrix.from_dense(gv_inv.T)
                # RU = D
                if asserts:
                    assert (
                        ((R.to_dense() @ U_t.to_dense().T) % 2) == D.to_dense()
                    ).all(), "RU should be D"

                state = sparse_reduction_state(
                    D, R, U_t, a_ordering, point, self.complex
                )
        key = self.get_point_key(point)
        self.state_map[key].append(state)
        return state

    def on_faustian(
        self,
        s1: cplx.simplex,
        s2: cplx.simplex,
        old_state: sparse_reduction_state | rs_reduction_state,
        new_state: sparse_reduction_state | rs_reduction_state,
    ):
        """Call this when a faustian swap happens."""
        pass

    def prune(
        self,
        s1: cplx.simplex,
        s2: cplx.simplex,
        old_state: sparse_reduction_state | rs_reduction_state,
        new_state: sparse_reduction_state | rs_reduction_state,
    ):
        """Return True if the interchange should be pruned."""
        return False

    def get_point_key(self, point: np.ndarray):
        raise Exception("Not implemented")

    def get_state_at_point(
        self, a: np.ndarray, typ: Type = None
    ) -> sparse_reduction_state | dense_reduction_state | None:
        """Retrieve the reduction state at the point `a`, if any. Returns the first match it finds.
        If you pass in `typ`, you can either give it `sparse_reduction_state` or `dense_reduction_state`, and
        it will only return states of that type.
        """
        with utils.Timed("vineyard.get_state_at_point"):
            k = self.get_point_key(a)
            states = self.state_map[k]
            if typ is not None:
                for state in states:
                    if isinstance(state, typ):
                        return state
                return None
            try:
                return states[0]
            except IndexError:
                return None

    def reduce_vine(
        self,
        state: sparse_reduction_state | dense_reduction_state | rs_reduction_state,
        point: np.ndarray,
        version: Version = "RS",
        asserts=False,
        debug=False,
    ) -> sparse_reduction_state | dense_reduction_state:
        """Compute the reduction at the given point, from the given state."""

        with utils.Timed("reduce_vine: ordering"):
            ordering = cplx.ordering.by_dist_to(self.complex, point)

        if version != "RS":
            raise Exception("Lazy me disabled the others")

        if True:
            with utils.Timed("reduce_vine.almost-all"):
                if isinstance(state, sparse_reduction_state):
                    with utils.Timed("from sparse"):
                        D = SM.from_py_sneakymatrix(state.D)
                        R = SM.from_py_sneakymatrix(state.R)
                        U_t = SM.from_py_sneakymatrix(state.U_t)
                elif isinstance(state, dense_reduction_state):
                    with utils.Timed("from dense"):
                        D = SM.from_py_sneakymatrix(SneakyMatrix.from_dense(state.D))
                        R = SM.from_py_sneakymatrix(SneakyMatrix.from_dense(state.R))
                        U_t = SM.from_py_sneakymatrix(
                            SneakyMatrix.from_dense(state.U.T)
                        )
                elif isinstance(state, rs_reduction_state):
                    D = state.D.clone2()
                    R = state.R.clone2()
                    U_t = state.U_t.clone2()
                else:
                    raise Exception("Illegal type of state: ", type(state))

                # Make a list `list[i] = j` such that `j` is the position in
                # `ordering` for the simpliex at position `i` in
                # `state.ordering`.
                our = state.ordering.list_unique_index()
                other_order = [ordering.i2o[s] for s in our]
                with utils.Timed("mars.reduce_vine"):
                    faus_swap_is, num_swaps = mars.reduce_vine(other_order, R, D, U_t)
                self.num_swaps += num_swaps
                self.swap_counts.append(num_swaps)
                # NOTE: since the values in `list` are from `ordering`, we
                # also need to use `ordering` here to get the actual simplex.
                swaps = [
                    (ordering.get_simplex(a), ordering.get_simplex(b))
                    for (a, b) in faus_swap_is
                ]

                # Store state before pruning, so that the pruning can have
                # access to the state.
                new_state = rs_reduction_state(D, R, U_t, ordering, point, self.complex)
                self.reduced_states.append(new_state)
                key = self.get_point_key(point)
                self.state_map[key].append(new_state)

                for s1, s2 in swaps:
                    assert (
                        s1.dim() == s2.dim()
                    ), f"This should not happen: {s1.dim()} != {s2.dim()}"
                    if not self.prune(s1, s2, state, new_state):
                        self.on_faustian(s1, s2, state, new_state)

                return new_state

        (
            swapped_simplices,
            swapped_indices,
        ) = state.ordering.compute_transpositions_rs(ordering)

        if version == Version.Sparse:
            with utils.Timed("reduce_vine Sparse"):
                if isinstance(state, sparse_reduction_state):
                    with utils.Timed("reduce_vine: sparse matrix copies"):
                        D = state.D.copy()
                        R = state.R.copy()
                        U_t = state.U_t.copy()
                elif isinstance(state, dense_reduction_state):
                    with utils.Timed("reduce_vine: from_dense matrix copies"):
                        D = SneakyMatrix.from_dense(state.D)
                        R = SneakyMatrix.from_dense(state.R)
                        U_t = SneakyMatrix.from_dense(state.U.T)
                else:
                    raise Exception("Illegal type of state: ", type(state))

                with utils.Timed("reduce_vine: loop"):
                    for swap_i, i in enumerate(swapped_indices):
                        with utils.Timed("reduce_vine: perform_one_swap"):
                            (_, _, faustian_swap) = perform_one_swap(i, R, U_t)
                        D.swap_cols_and_rows(i, i + 1)

                        if asserts:
                            with utils.Timed("RU=D check"):
                                RU = (R.to_dense() @ U_t.to_dense().T) % 2
                                assert (RU == D.to_dense()).all()

                        if faustian_swap:
                            s1, s2 = swapped_simplices[swap_i]
                            assert (
                                s1.dim() == s2.dim()
                            ), f"This should not happen: {s1.dim()} != {s2.dim()}"
                            self.on_faustian(s1, s2, state.point, point)

                    state = sparse_reduction_state(
                        D, R, U_t, ordering, point, self.complex
                    )
                    self.reduced_states.append(state)
        elif version == Version.Dense:
            with utils.Timed("reduce_vine Dense"):
                with utils.Timed("vineyard.reduce_from_state dense matrix copies"):
                    if isinstance(state, sparse_reduction_state):
                        D = state.D.to_dense()
                        R = state.R.to_dense()
                        U = state.U_t.to_dense().T
                    elif isinstance(state, dense_reduction_state):
                        D = state.D.copy()
                        R = state.R.copy()
                        U = state.U.copy()
                    else:
                        raise Exception("Illegal type of state: ", type(state))

                with utils.Timed("vine_to_vine dense loop"):
                    for swap_i, i in enumerate(swapped_indices):
                        P = np.eye(R.shape[0], dtype=int)
                        P[i, i] = P[i + 1, i + 1] = 0
                        P[i, i + 1] = P[i + 1, i] = 1
                        PDP = P @ D @ P

                        with utils.Timed("perform_one_swap"):
                            (newR, newU, faustian_swap) = perform_one_swap_DENSE(
                                i, R, U, debug=debug
                            )

                        if asserts:
                            assert is_binary(newR)
                            assert is_binary(newU)

                        if faustian_swap:
                            s1, s2 = swapped_simplices[swap_i]
                            assert (
                                s1.dim() == s2.dim()
                            ), f"This should not happen: {s1.dim()} != {s2.dim()}"
                            self.on_faustian(s1, s2, state.point, point)
                        R = newR
                        U = newU
                        D = PDP
                    state = dense_reduction_state(
                        D, R, U, ordering, point, self.complex
                    )
                    self.reduced_states.append(state)
        else:
            with utils.Timed("reduce_vine RS"):
                if isinstance(state, sparse_reduction_state):
                    with utils.Timed("from sparse"):
                        D = SM.from_py_sneakymatrix(state.D)
                        R = SM.from_py_sneakymatrix(state.R)
                        U_t = SM.from_py_sneakymatrix(state.U_t)
                elif isinstance(state, dense_reduction_state):
                    with utils.Timed("from dense"):
                        D = SM.from_py_sneakymatrix(SneakyMatrix.from_dense(state.D))
                        R = SM.from_py_sneakymatrix(SneakyMatrix.from_dense(state.R))
                        U_t = SM.from_py_sneakymatrix(
                            SneakyMatrix.from_dense(state.U.T)
                        )
                elif isinstance(state, rs_reduction_state):
                    D = state.D.clone2()
                    R = state.R.clone2()
                    U_t = state.U_t.clone2()
                else:
                    raise Exception("Illegal type of state: ", type(state))

                with utils.Timed("reduce_vine: loop"):
                    faustians = SM_vine_to_vine(D, R, U_t, swapped_indices)
                    for swap_i in faustians:
                        s1, s2 = swapped_simplices[swap_i]
                        assert (
                            s1.dim() == s2.dim()
                        ), f"This should not happen: {s1.dim()} != {s2.dim()}"
                        self.on_faustian(s1, s2, state.point, point)
                    state = rs_reduction_state(D, R, U_t, ordering, point, self.complex)
                    self.reduced_states.append(state)
        key = self.get_point_key(point)
        self.state_map[key].append(state)
        return state


def perform_one_swap_DENSE(i: int, R: np.ndarray, U: np.ndarray, debug: bool = False):
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
                if debug:
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
                if debug:
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
            if debug:
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
                if debug:
                    print("case 2.1.1")
                assert is_probably_reduced(RW)
                assert is_probably_reduced(PRWP)
                assert is_upper_triangular(PWUP)
                # R.check_matrix("case 2.1.1")
                return (PRWP, PWUP, None)
            # Case 2.1.2: low(i + 1) < low(i).
            else:
                if debug:
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
            if debug:
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
            if debug:
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
            if debug:
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
        if debug:
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
        with utils.Timed("perform_one_swap case 1"):
            # Let U [i, i + 1] = 0, just in case.
            U_t[i + 1, i] = 0

            # Case 1.1: there are columns k and ℓ with low(k) = i, low(ℓ) = i +
            # 1, and R[i, ℓ] = 1.
            with utils.Timed("low_inv"):
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
        with utils.Timed("perform_one_swap case 2"):
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
        with utils.Timed("perform_one_swap case 3"):
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
        with utils.Timed("perform_one_swap case 4"):
            # Set U [i, i + 1] = 0, just in case.
            U_t[i + 1, i] = 0
            R.swap_cols_and_rows(i, i + 1)  # P R P
            U_t.swap_cols_and_rows(i, i + 1)  # P U P
            R.check_matrix("case 4")
            return (R, U_t, None)

    raise Exception("bottom of the function; This should never happen.")


def prune_coboundary(
    complex: cplx.complex,
    s1: cplx.simplex,
    s2: cplx.simplex,
    _state1: rs_reduction_state | sparse_reduction_state,
    _state2: rs_reduction_state | sparse_reduction_state,
):
    """
    Prune if the two simplices have a common simplex in their coboundaries.
    If the simplices are vertices, this means that there is an edge connecting them.
    If the simplices are edges, this means that there is a triangle in which both edges are.
    """
    cob1 = complex.get_coboundary(s1)
    cob2 = complex.get_coboundary(s2)
    if cob1 & cob2:
        return True
    return False


def prune_euclidean(
    complex: cplx.complex,
    s1: cplx.simplex,
    s2: cplx.simplex,
    point_a: np.ndarray,
    point_b: np.ndarray,
    eps: float,
):
    """
    Prunes based on squared euclidean distance from the `simplex_to_center`
    point of the simplices.

    `eps` is the multiplier of the grid distance which is the largest allowed
    jump distance.
    """
    grid_dist = np.linalg.norm(point_a - point_b)
    simplex_a = complex.simplex_to_center(s1)
    simplex_b = complex.simplex_to_center(s2)
    simplex_dist = np.linalg.norm(simplex_a - simplex_b)
    if simplex_dist < grid_dist * eps:
        return True
    return False
