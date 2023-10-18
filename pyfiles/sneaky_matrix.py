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
            entries = set(np.where(mat[:, c] == 1)[0])
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

    def eye(n: int) -> SneakyMatrix:
        """
        Construct a new square identity matrix with the given number of rows and columns.
        """
        sm = SneakyMatrix()
        sm.cols = n
        sm.rows = n
        for i in range(n):
            sm.entries[i] = {i}
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
        return 1 if self.row_map[r] in self.entries[c] else 0

    def copy(self) -> SneakyMatrix:
        """
        Deep copy this matrix.
        """
        return deepcopy(self)

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

    def swap_cols(self, c1, c2):
        """
        Swap columns i and j.
        """
        if c1 < 0 or c1 >= self.cols:
            raise Exception(
                f"Column index out of bounds: 0 <!= {c1} <!= {self.cols}",
            )
        if c2 < 0 or c2 >= self.cols:
            raise Exception(
                f"Column index out of bounds: 0 <!= {c2} <!= {self.cols}",
            )
        self.entries[c1], self.entries[c2] = self.entries[c2], self.entries[c1]

    def swap_rows(self, r1, r2):
        """
        Swap rows r1 and r2.
        """
        if r1 < 0 or r1 >= self.rows:
            raise Exception(
                f"Row index out of bounds: 0 <!= {r1} <!= {self.rows}",
            )
        if r2 < 0 or r2 >= self.rows:
            raise Exception(
                f"Row index out of bounds: 0 <!= {r2} <!= {self.rows}",
            )
        self.row_map[r1], self.row_map[r2] = self.row_map[r2], self.row_map[r1]

    def swap_cols_and_rows(self, a, b):
        """
        Swap columns a and b, and rows a and b.
        """
        self.swap_cols(a, b)
        self.swap_rows(a, b)

    def add_cols(self, c1, c2):
        """
        Add column c2 to column c1.
        """
        self.entries[c1].symmetric_difference_update(self.entries[c2])
        if self.entries[c1] == set():
            del self.entries[c1]

    def colmax(self, c):
        """
        Return the maximum row index in column c.
        """
        return max(self.entries[c])

    @property
    def shape(self):
        return (self.rows, self.cols)
