import unittest

from pyfiles import matrix as mat

import numpy as np


class TestTest(unittest.TestCase):
    def setUp(self) -> None:
        self.init_matrix = np.array(
            [
                [0, 1, 0, 0, 0, 0, 0, 0],
                [0, 1, 1, 0, 0, 0, 0, 0],
                [0, 0, 1, 1, 0, 0, 0, 0],
                [0, 0, 0, 1, 1, 0, 0, 0],
                [0, 0, 0, 0, 1, 1, 0, 0],
                [0, 0, 0, 0, 0, 1, 1, 0],
                [0, 0, 0, 0, 0, 0, 1, 1],
                [0, 0, 0, 0, 0, 0, 0, 0],
            ]
        )

        self.reduced_matrix = np.array(
            [
                [0, 1, 0, 0, 0, 0, 0, 1],
                [0, 1, 1, 0, 0, 0, 0, 0],
                [0, 0, 1, 1, 0, 0, 0, 0],
                [0, 0, 0, 1, 1, 0, 0, 0],
                [0, 0, 0, 0, 1, 1, 0, 0],
                [0, 0, 0, 0, 0, 1, 1, 0],
                [0, 0, 0, 0, 0, 0, 1, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
            ]
        )

    def test_reduction_works(self):
        matrix = mat.bdmatrix()
        matrix.initmatrix = self.init_matrix
        reduced = matrix.reduce()
        all_entries_are_equal = (reduced == self.reduced_matrix).all()
        self.assertTrue(all_entries_are_equal)
