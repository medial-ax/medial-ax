from __future__ import annotations
from collections import defaultdict
from copy import deepcopy

from typing import DefaultDict, Set

import numpy as np


class keydefaultdict(defaultdict):
    """
    A defaultdict that inserts the key as the value if the key is missing.
    """

    def __missing__(self, key):
        self[key] = key
        return key


class SneakyMatrix:
    """
    This is a sparse representation of a matric that allows for efficient row/column swaps,
    as well as efficient column additions.
    """

    entries: DefaultDict[int, Set[int]]
    row_map: DefaultDict[int, int]
    """Store the index of the row that the original row at each index was
    swapped to."""

    cols: int
    rows: int

    def from_dense(mat: np.ndarray) -> SneakyMatrix:
        """
        Construct a SneakyMatrix from a dense numpy matrix.
        """
        sm = SneakyMatrix()
        (rows, cols) = mat.shape
        for c in range(cols):
            entries = [r for r in range(rows) if mat[r, c] == 1]
            sm.entries[c] = set(entries)
        sm.cols = cols
        sm.rows = rows
        return sm

    def zeros(rows: int, cols: int) -> SneakyMatrix:
        """
        Construct a new zeroed matrix with the given number of rows and columns.
        """
        sm = SneakyMatrix()
        sm.cols = cols
        sm.rows = rows
        return sm

    def __init__(self):
        self.entries = defaultdict(set)
        self.row_map = keydefaultdict()

    def __setitem__(self, key, val):
        if not isinstance(key, tuple):
            raise Exception("Only (row, col) indexing is supported")
        r, c = key
        if not isinstance(r, int) or not isinstance(c, int):
            raise Exception("Only direct indexing is supported (no : slices)")
        elif r < 0 or r >= self.rows:
            raise Exception("Row index out of bounds")
        elif c < 0 or c >= self.cols:
            raise Exception("Column index out of bounds")
        rr = self.row_map[r]
        if val == 1:
            self.entries[c].add(rr)
        else:
            self.entries[c].discard(rr)

    def __getitem__(self, key):
        if not isinstance(key, tuple):
            raise Exception("Only (row, col) indexing is supported")
        r, c = key
        if not isinstance(r, int) or not isinstance(c, int):
            raise Exception("Only direct indexing is supported (no : slices)")
        elif r < 0 or r >= self.rows:
            raise Exception("Row index out of bounds")
        elif c < 0 or c >= self.cols:
            raise Exception("Column index out of bounds")
        return 1 if r in map(lambda r: self.row_map[r], self.entries[c]) else 0

    def copy(self) -> SneakyMatrix:
        """
        Deep copy this matrix.
        """
        return deepcopy.copy(self)

    def to_dense(self) -> np.ndarray:
        """
        Convert to a dense matrix.
        """
        mat = np.zeros((self.rows, self.cols), dtype=int)
        for c in range(self.cols):
            for _r in self.entries[c]:
                r = self.row_map[_r]
                mat[r, c] = 1
        return mat

    def swap_cols(self, i, j):
        """
        Swap columns i and j.
        """
        self.entries[i], self.entries[j] = self.entries[j], self.entries[i]

    def swap_rows(self, i, j):
        """
        Swap rows i and j.
        """
        self.row_map[i], self.row_map[j] = self.row_map[j], self.row_map[i]

    def add_cols(self, i, j):
        """
        Add column j to column i.
        """
        self.entries[i].symmetric_difference_update(self.entries[j])
