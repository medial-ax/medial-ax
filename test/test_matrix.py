from collections import defaultdict
from typing import Dict, List
import unittest

from pyfiles import matrix as mat, input as inp, complex as cplx

import numpy as np


def transpose(d: Dict[str, List[int]]) -> List[Dict[str, int]]:
    """Transforms a SoA dict to a AoS dict."""
    # This is read-only code
    return [dict(zip(d.keys(), vals)) for vals in zip(*d.values())]


class TestMatrixReduction(unittest.TestCase):
    def test_can_add_cols_in_rev_order(self):
        init_matrix = np.array(
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
        correct_reduced = np.array(
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
        matrix = mat.bdmatrix()
        matrix.initmatrix = init_matrix
        reduced = matrix.reduce()
        all_entries_are_equal = (reduced == correct_reduced).all()
        self.assertTrue(all_entries_are_equal)

    def test_triangle(self):
        init_matrix = np.array(
            [
                [0, 1, 1, 1, 0, 0, 0],
                [0, 0, 0, 0, 1, 0, 1],
                [0, 0, 0, 0, 1, 1, 0],
                [0, 0, 0, 0, 0, 1, 1],
                [0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0],
            ]
        )
        correct_reduced = np.array(
            [
                [0, 1, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 1, 0, 0],
                [0, 0, 0, 0, 1, 1, 0],
                [0, 0, 0, 0, 0, 1, 0],
                [0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0],
            ]
        )
        matrix = mat.bdmatrix()
        matrix.initmatrix = init_matrix
        reduced = matrix.reduce()
        all_entries_are_equal = (reduced == correct_reduced).all()
        self.assertTrue(all_entries_are_equal)

    def test_two_disjoint_triangles(self):
        init_matrix = np.array(
            [
                [0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 0],
                [0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            ]
        )
        correct_reduced = np.array(
            [
                [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            ]
        )
        matrix = mat.bdmatrix()
        matrix.initmatrix = init_matrix
        reduced = matrix.reduce()
        all_entries_are_equal = (reduced == correct_reduced).all()
        self.assertTrue(all_entries_are_equal)

    def test_bookkeeping_still_works(self):
        """
        This is mostly copied stuff over from the notebook, but good to know
        that we don't break anything when refactoring.
        """
        our_complex = inp.read_obj("./input/two_triangles.obj")
        our_complex.key_point = (0.4, 0.3)
        distlist = cplx.augment_with_radialdist(our_complex)
        all_simplices = our_complex.sort_by_dist(distlist)
        matrix = mat.bdmatrix()
        matrix.make_matrix(our_complex)
        matrix.initmatrix
        matrix.redmatrix = matrix.reduce()
        matrix.find_lows_zeros(all_simplices)

        lowestones = transpose(matrix.lowestones)

        our_lowestones, our_zerocolumns = matrix.compute_lowest_1s(all_simplices)

        # (col, row) is unique, so we can group:
        lowestones_grouped = defaultdict(list)
        for e in lowestones:
            lowestones_grouped[(e["col"], e["row"])].append(e)
        for e in our_lowestones:
            lowestones_grouped[(e["col"], e["row"])].append(e)

        for group in lowestones_grouped.values():
            self.assertEqual(len(group), 2)
            # Group should all have the same values for all keys
            for key in set(group[0].keys()):
                self.assertTrue(all(g[key] == group[0][key] for g in group))

        zerocolumns = transpose(matrix.zerocolumns)
        zerocolumns_grouped = defaultdict(list)
        for e in zerocolumns:
            zerocolumns_grouped[e["col"]].append(e)
        for e in our_zerocolumns:
            zerocolumns_grouped[e["col"]].append(e)

        for group in zerocolumns_grouped.values():
            self.assertEqual(len(group), 2)
            # Group should all have the same values for all keys
            for key in set(group[0].keys()):
                self.assertTrue(all(g[key] == group[0][key] for g in group))
