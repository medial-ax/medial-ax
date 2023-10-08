from math import sin
import unittest
import numpy as np

from pyfiles.sneaky_matrix import SneakyMatrix


class TestSneakyMatrix(unittest.TestCase):
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

        A = np.array([[1, 0, 0], [0, 1, 0], [0, 0, 1]])
        sm = SneakyMatrix.from_dense(A)

        sm.swap_rows(0, 1)
        self.assertTrue(sm[1, 0])
        self.assertTrue(sm[0, 1])
        self.assertTrue(sm[2, 2])

        sm.swap_rows(0, 2)  # 7; 1; 4
        self.assertTrue(sm[2, 0])
        self.assertTrue(sm[0, 1])
        self.assertTrue(sm[1, 2])

        sm.swap_rows(2, 1)  # 7; 4; 1
        self.assertTrue(sm[2, 0])
        self.assertTrue(sm[1, 1])
        self.assertTrue(sm[0, 2])

        sm.swap_rows(1, 1)  # 7; 4; 1
        self.assertTrue(sm[2, 0])
        self.assertTrue(sm[1, 1])
        self.assertTrue(sm[0, 2])

        sm.swap_rows(1, 0)  # 4; 7; 1
        self.assertTrue(sm[1, 0])
        self.assertTrue(sm[2, 1])
        self.assertTrue(sm[0, 2])

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
