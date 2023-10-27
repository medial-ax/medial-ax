from __future__ import annotations
from collections import defaultdict
from copy import deepcopy

from typing import DefaultDict, Dict, Set

import numpy as np
from . import plot as ourplot


class permutation:
    _map: keydefaultdict
    _inv: keydefaultdict

    def __init__(self):
        self._map = keydefaultdict()
        self._inv = keydefaultdict()

    def map(self, n):
        return self._map[n]

    def inv(self, n):
        return self._inv[n]

    def swap(self, i, j):
        self._map[i], self._map[j] = self._map[j], self._map[i]
        self._inv[self._map[i]], self._inv[self._map[j]] = i, j


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
    row_map: permutation
    """Maps `r` to `rr`, "logical" rows to "stored" rows."""
    col_map: permutation
    """Maps `c` to `cc`, "logical" columns to "stored" columns."""

    col_low_one_cache: Dict[int, int]
    """Maps rr to cc."""

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
        self.row_map = permutation()
        self.col_map = permutation()
        self.col_low_one_cache = {}

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
        rr = self.row_map.map(r)
        cc = self.col_map.map(c)
        if val == 1:
            self.entries[cc].add(rr)
        else:
            self.entries[cc].discard(rr)

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

        rr = self.row_map.map(r)
        cc = self.col_map.map(c)
        return 1 if rr in self.entries[cc] else 0

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
        for cc in range(self.cols):
            c = self.col_map.inv(cc)
            for rr in self.entries[cc]:
                r = self.row_map.inv(rr)
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
        self.col_map.swap(c1, c2)
        r1 = self.colmax(c1)
        r2 = self.colmax(c2)
        self.col_low_one_cache[r1] = c1
        self.col_low_one_cache[r2] = c2

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
        self.row_map.swap(r1, r2)
        self.col_low_one_cache.pop(r1, None)
        self.col_low_one_cache.pop(r2, None)

    def swap_cols_and_rows(self, a, b):
        """
        Swap columns a and b, and rows a and b.
        """
        self.swap_rows(a, b)
        self.swap_cols(a, b)

    def add_cols(self, c1, c2):
        """
        Add column c2 to column c1.
        """
        cc1 = self.col_map.map(c1)
        cc2 = self.col_map.map(c2)
        old_low = self.colmax(c1)
        self.entries[cc1].symmetric_difference_update(self.entries[cc2])
        new_low = self.colmax(c1)
        if old_low != new_low:
            self.col_low_one_cache.pop(old_low, None)
            self.col_low_one_cache[new_low] = c1
        if self.entries[cc1] == set():
            del self.entries[cc1]

    def colmax(self, c):
        """
        Return the maximum row index in column c.
        """
        cc = self.col_map.map(c)
        r = max(map(lambda rr: self.row_map.inv(rr), self.entries[cc]), default=None)
        self.col_low_one_cache[r] = c
        return r

    def col_with_low(self, r):
        if r in self.col_low_one_cache:
            return self.col_low_one_cache[r]

        for cc in self.entries.keys():
            c = self.col_map.inv(cc)
            max = self.colmax(c)
            if max == r:
                self.col_low_one_cache[r] = c
                return c
        return None

        # # try:
        # #     rr = self.row_map.map(r)
        # #     cc = self.col_low_one_cache[rr]
        # #     return self.col_map.inv(cc)
        # # except:
        # all_cs = []
        # for cc in self.entries.keys():
        #     c = self.col_map.inv(cc)
        #     max = self.colmax(c)
        #     if max == r:
        #         # self.col_low_one_cache[rr] = cc
        #         all_cs.append(c)
        #         # return c
        # if len(all_cs) > 1:
        #     print(all_cs)
        #     for c in all_cs:
        #         cc = self.col_map.map(c)
        #         print(self.entries[cc])
        #     print(self.to_dense())
        # if all_cs == []:
        #     return None
        # return all_cs[0]

    def col_is_not_empty(self, c):
        """
        Return True if column c is not empty.
        """
        cc = self.col_map.map(c)
        return self.entries[cc] != set()

    def check_matrix(self, msg):
        # print(msg)
        return
        d = {}
        for c in range(self.cols):
            low = self.colmax(c)
            if low is None:
                continue
            if low in d:
                print()
                print(msg)
                print()
                print(f"Duplicate low: low({d[low]}) == low({c}) = {low}")
            d[low] = c

    @property
    def shape(self):
        return (self.rows, self.cols)

    def columns(self):
        """Return a list of the columns with the rows in each column. Both columns and rows are sorted."""
        ccs = sorted(self.col_map.inv(cc) for cc in self.entries.keys())
        items = [
            (
                cc,
                sorted(
                    self.row_map.inv(rr) for rr in self.entries[self.col_map.map(cc)]
                ),
            )
            for cc in ccs
        ]
        return items
