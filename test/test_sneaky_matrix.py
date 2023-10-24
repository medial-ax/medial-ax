from math import sin
import unittest
import numpy as np

from pyfiles.sneaky_matrix import SneakyMatrix


class TestSneakyMatrix(unittest.TestCase):
    def test_eye(self):
        for i in range(1, 10):
            sm = SneakyMatrix.eye(i)
            A = np.eye(i)
            self.assertTrue((sm.to_dense() == A).all())

    def test_from_dense(self):
        R, C = 4, 7
        A = (np.random.random((R, C)) * 10).astype(int) % 2
        SM = SneakyMatrix.from_dense(A)

        for r in range(R):
            for c in range(C):
                self.assertEqual(A[r, c], SM[r, c])

    def test_from_to_dense_roundtrip(self):
        R, C = 4, 7
        A = (np.random.random((R, C)) * 10).astype(int) % 2
        AA = SneakyMatrix.from_dense(A).to_dense()
        self.assertTrue((A == AA).all())

    def test_swap_columns(self):
        R, C = 4, 7
        A = (np.random.random((R, C)) * 10).astype(int) % 2

        for c1 in range(C):
            for c2 in range(C):
                sm = SneakyMatrix.from_dense(A)
                sm.swap_cols(c1, c2)
                for r in range(R):
                    for c in range(C):
                        if c == c1:
                            self.assertEqual(sm[r, c], A[r, c2])
                        elif c == c2:
                            self.assertEqual(sm[r, c], A[r, c1])
                        else:
                            self.assertEqual(sm[r, c], A[r, c])

    def test_swap_rows(self):
        R, C = 4, 7
        A = (np.random.random((R, C)) * 10).astype(int) % 2

        for r1 in range(R):
            for r2 in range(R):
                sm = SneakyMatrix.from_dense(A)
                sm.swap_rows(r1, r2)
                for r in range(R):
                    for c in range(C):
                        if r == r1:
                            self.assertEqual(sm[r, c], A[r2, c])
                        elif r == r2:
                            self.assertEqual(sm[r, c], A[r1, c])
                        else:
                            self.assertEqual(sm[r, c], A[r, c])

        A = np.zeros((6, 1))
        A[0, 0] = 1
        sm = SneakyMatrix.from_dense(A)

        sm.swap_rows(0, 1)
        self.assertTrue(sm[1, 0])
        sm.swap_rows(0, 2)
        self.assertTrue(sm[1, 0])
        sm.swap_rows(2, 1)
        self.assertTrue(sm[2, 0])
        sm.swap_rows(2, 3)
        self.assertTrue(sm[3, 0])
        sm.swap_rows(0, 3)
        self.assertTrue(sm[0, 0])
        sm.swap_rows(1, 4)
        self.assertTrue(sm[0, 0])
        sm.swap_rows(0, 4)
        self.assertTrue(sm[4, 0])

    def test_add_cols(self):
        R, C = 3, 5
        sm = SneakyMatrix.zeros(R, C)
        nums = [
            [1, 0, 0, 1, 0],
            [0, 0, 0, 1, 1],
            [0, 1, 0, 1, 0],
        ]
        for r in range(R):
            for c in range(C):
                sm[r, c] = nums[r][c]

        A = sm.to_dense()
        for i, j in [
            (0, 1),
            (1, 2),
            (4, 1),
            (2, 3),
            (3, 4),
            (0, 3),
            (2, 1),
        ]:
            sm.add_cols(i, j)
            A[:, i] += A[:, j]
            A[:, i] %= 2
            self.assertTrue((sm.to_dense() == A).all())

        sm = SneakyMatrix.zeros(3, 3)
        sm[1, 1] = 1
        sm.add_cols(0, 1)
        sm.add_cols(2, 0)
        self.assertEqual(sm[1, 0], 1)
        self.assertEqual(sm[1, 1], 1)
        self.assertEqual(sm[1, 2], 1)

    def test_add_cols_after_rc_swap(self):
        sm = SneakyMatrix.zeros(3, 3)
        sm[1, 1] = 1
        sm.swap_cols_and_rows(0, 1)  # (0, 0) has the 1 now
        sm.add_cols(1, 0)
        sm.add_cols(2, 0)
        self.assertEqual(sm[0, 0], 1)
        self.assertEqual(sm[0, 1], 1)
        self.assertEqual(sm[0, 2], 1)

        sm = SneakyMatrix.zeros(3, 3)
        sm[1, 1] = 1
        sm.swap_cols(0, 1)  # (1, 0) has the 1 now
        sm.add_cols(1, 0)
        sm.add_cols(2, 0)
        self.assertEqual(sm[1, 0], 1)
        self.assertEqual(sm[1, 1], 1)
        self.assertEqual(sm[1, 2], 1)

        sm = SneakyMatrix.zeros(3, 3)
        sm[1, 1] = 1
        sm.swap_rows(1, 0)  # (0, 1) has the 1 now
        sm.add_cols(0, 1)
        sm.add_cols(2, 0)
        self.assertEqual(sm[0, 0], 1)
        self.assertEqual(sm[0, 1], 1)
        self.assertEqual(sm[0, 2], 1)

    def test_shape_is_npshape(self):
        sm = SneakyMatrix.zeros(3, 4)
        self.assertEqual(sm.shape, (3, 4))
        A = np.zeros((3, 4))
        self.assertEqual(sm.shape, A.shape)

    def test_swaps_bug(self):
        A = np.array(
            [
                [0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0],
                [0, 0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            ],
            dtype=int,
        )

        A_P = A.copy()
        A_sneak = SneakyMatrix.from_dense(A)
        A_swap = A.copy()

        def prnt(A):
            print(str(A).replace("0", " ").replace("1", "X"))

        for i in [2, 3, 5]:
            print(f"============ i = {i} ===========")
            P = np.eye(A.shape[0], dtype=int)
            P[i, i] = P[i + 1, i + 1] = 0
            P[i, i + 1] = P[i + 1, i] = 1
            A_P = P @ A_P @ P.T

            A_swap[:, [i, i + 1]] = A_swap[:, [i + 1, i]]
            A_swap[[i, i + 1]] = A_swap[[i + 1, i]]

            A_sneak.swap_cols_and_rows(i, i + 1)
            A_sneak_dense = A_sneak.to_dense()

            print("A_swap")
            prnt(A_swap)
            print()
            print("A_P")
            prnt(A_P)
            print()
            print("A_sneak_dense")
            prnt(A_sneak_dense)
            print()

            self.assertTrue((A_swap == A_P).all())
            self.assertTrue((A_sneak_dense == A_swap).all())
            self.assertTrue((A_sneak_dense == A_P).all())
