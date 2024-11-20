use crate::permutation::Permutation;
use serde::{Deserialize, Serialize};

pub type CI = i16;

#[derive(PartialEq, Eq, Debug, Clone, Serialize, Deserialize)]
pub struct Col(Vec<CI>);

impl Col {
    fn new() -> Self {
        Col(Vec::new())
    }

    pub fn mem_usage(&self) -> usize {
        self.0.capacity() * std::mem::size_of::<CI>()
    }

    /// Checks if the column contains an entry at the given row.
    pub fn has(&self, a: CI) -> bool {
        self.0.binary_search(&a).is_ok()
    }

    /// Checks if the column is empty.
    pub fn empty(&self) -> bool {
        self.0.is_empty()
    }

    /// Set the given row.  Do nothing if the row is already set.
    pub fn set(&mut self, r: CI) {
        match self.0.binary_search(&r) {
            Ok(_) => {}
            Err(i) => {
                self.0.insert(i, r);
            }
        }
    }

    /// Clear a row entry.  Do nothing if the row is not set.
    pub fn unset(&mut self, r: CI) {
        match self.0.binary_search(&r) {
            Ok(i) => {
                self.0.remove(i);
            }
            Err(_) => {}
        }
    }

    /// Add in another column in Z/Z2 arithmetic.
    pub fn add_mod2(&self, other: &Self) -> Self {
        let mut v = Vec::new();
        let mut i = 0;
        let mut j = 0;

        while i < self.0.len() && j < other.0.len() {
            if self.0[i] < other.0[j] {
                v.push(self.0[i]);
                i += 1;
            } else if self.0[i] > other.0[j] {
                v.push(other.0[j]);
                j += 1;
            } else {
                i += 1;
                j += 1;
            }
        }

        while i < self.0.len() {
            v.push(self.0[i]);
            i += 1;
        }

        while j < other.0.len() {
            v.push(other.0[j]);
            j += 1;
        }

        Col(v)
    }

    /// Get the lowest 1 in this column, under the permutation.
    ///
    /// Note that the returned (say) row is an `rr`, since we only `max` over the permutation, as
    /// opposed to map the permutation and then max.
    pub fn max_under(&self, perm: Option<&Permutation>) -> Option<CI> {
        if let Some(p) = perm {
            self.0.iter().max_by_key(|&&rr| p.inv(rr)).cloned()
        } else {
            self.0.iter().max().cloned()
        }
    }

    /// Turn the column into a `Vec<usize>` of row indices.
    pub fn as_vec(&self) -> Vec<CI> {
        self.0.clone()
    }
}

impl From<Vec<CI>> for Col {
    fn from(v: Vec<CI>) -> Self {
        Col(v)
    }
}

/// Sparse column storage for a bit matrix.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub(crate) struct Columns {
    columns: Vec<Col>,
    rows: CI,
    cols: CI,
}

impl Columns {
    fn new(rows: CI, cols: CI) -> Self {
        Self {
            columns: vec![Col::new(); cols as usize],
            rows,
            cols,
        }
    }

    pub fn eye(n: CI) -> Self {
        let mut columns = Vec::with_capacity(n as usize);
        for i in 0..n {
            let mut v = Vec::with_capacity(1);
            v.push(i);
            columns.push(Col(v));
        }
        Self {
            columns,
            rows: n,
            cols: n,
        }
    }

    fn ncols(&self) -> CI {
        self.cols
    }

    fn nrows(&self) -> CI {
        self.rows
    }

    fn get(&self, r: CI, c: CI) -> bool {
        self.columns[c as usize].has(r)
    }

    fn set(&mut self, r: CI, c: CI, val: bool) {
        if val {
            self.columns[c as usize].set(r);
        } else {
            self.columns[c as usize].unset(r);
        }
    }

    // TODO: do AddAssign instead here
    fn add_cols(&mut self, c1: CI, c2: CI) {
        let col_1 = &self.columns[c1 as usize];
        let col_2 = &self.columns[c2 as usize];
        let c3 = col_1.add_mod2(col_2);
        self.columns[c1 as usize] = c3;
    }

    fn colmax(&self, c: CI, row_perm: Option<&Permutation>) -> Option<CI> {
        let col = &self.columns[c as usize];
        col.max_under(row_perm)
    }

    fn col_with_low(&self, r: CI, row_perm: Option<&Permutation>) -> Option<CI> {
        for (c, col) in self.columns.iter().enumerate() {
            // If we don't even have the mapped value, it is for sure not the max under the parm.
            if !col.has(r) {
                continue;
            }
            if col.max_under(row_perm) == Some(r) {
                return Some(c as CI);
            }
        }
        None
    }

    /// Returns all entries that are set as `(row, col)` pairs.
    fn to_pairs(&self) -> Vec<(CI, CI)> {
        let mut pairs = Vec::new();
        for c in 0..self.cols {
            for r in &self.columns[c as usize].0 {
                pairs.push((*r, c));
            }
        }
        pairs
    }

    fn from_pairs(rows: CI, cols: CI, pairs: &[(CI, CI)]) -> Self {
        let mut columns = vec![Col::new(); cols as usize];
        for &(r, c) in pairs {
            columns[c as usize].set(r);
        }
        Columns {
            columns,
            rows,
            cols,
        }
    }

    /// Double the height of the matrix, and initialize the new block to be the identity.
    fn bottom_pad_with_identity(&mut self) {
        let rows = self.rows;
        self.rows *= 2;
        for i in 0..rows {
            self.set(rows + i, i, true);
        }
    }

    fn col_is_empty(&self, c: CI) -> bool {
        self.columns[c as usize].empty()
    }

    fn col_is_not_empty(&self, c: CI) -> bool {
        !self.col_is_empty(c)
    }

    fn col_as_vec(&self, c: CI) -> Vec<CI> {
        self.columns[c as usize].0.clone()
    }

    /// Compute the number of bytes used.
    pub(crate) fn mem_usage(&self) -> usize {
        self.columns.iter().map(|c| c.mem_usage()).sum::<usize>()
            + self.columns.capacity() * std::mem::size_of_val(&self.columns[0])
            + 2 * std::mem::size_of_val(&self.rows)
    }

    fn fill_ratio(&self) -> f64 {
        let max = self.nrows() as f64 * self.ncols() as f64;
        let used = self.columns.iter().map(|c| c.0.len() as f64).sum::<f64>();
        return used / max;
    }
}

// impl Serialize for Columns {
//     fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
//     where
//         S: serde::Serializer,
//     {
//         let v = self
//             .columns
//             .iter()
//             .zip(0..self.ncols())
//             .filter(|(c, _)| !c.empty())
//             .map(|(c, i)| (i, c.clone()))
//             .collect::<Vec<(CI, Col)>>();
//         (self.rows, self.cols, v).serialize(serializer)
//     }
// }
//
// impl<'de> Deserialize<'de> for Columns {
//     fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
//     where
//         D: serde::Deserializer<'de>,
//     {
//         let (rows, cols, v) = <(CI, CI, Vec<(CI, Col)>)>::deserialize(deserializer)?;
//         let mut cols = Columns::new(rows, cols);
//         for (c, col) in v {
//             cols.columns[c as usize] = col;
//         }
//         Ok(cols)
//     }
// }

/// A bit-buffer for matrix storage.  Each column is stored as a contiguous list of [u64]s.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct BitBuffer {
    bits: Vec<u64>,
    /// The number of blocks in each column
    blocks: u32,

    rows: CI,
}

impl BitBuffer {
    fn new(rows: CI, cols: CI) -> Self {
        assert!(0 <= rows, "rows must be non-negative");
        assert!(0 <= cols, "rows must be non-negative");
        let use_rows = (rows >> 6) as u32 + if rows & 63 == 0 { 0 } else { 1 };
        let bits = vec![0; use_rows as usize * cols as usize];
        Self {
            bits,
            blocks: use_rows,
            rows,
        }
    }

    fn from_pairs(rows: CI, cols: CI, pairs: &[(CI, CI)]) -> Self {
        let mut bb = BitBuffer::new(rows, cols);
        for &(r, c) in pairs {
            bb.set(r, c, true);
        }
        bb
    }

    fn eye(n: CI) -> Self {
        assert!(0 <= n, "dimension must be non-negative");
        let mut b = Self::new(n, n);
        for i in 0..n {
            b.set(i, i, true);
        }
        b
    }

    fn ncols(&self) -> CI {
        if self.blocks == 0 {
            0
        } else {
            (self.bits.len() / self.blocks as usize) as CI
        }
    }

    fn nrows(&self) -> CI {
        self.rows
    }

    /// Compute the bit-offset and block index for the entry of a row, column pair.
    fn get_index_offset(&self, r: CI, c: CI) -> (usize, usize) {
        let bit_in_block = (r & 63) as usize;
        let block_i = r >> 6;
        let block = self.first_block(c) + block_i as usize;
        (bit_in_block, block)
    }

    fn get(&self, r: CI, c: CI) -> bool {
        let (ind, off) = self.get_index_offset(r, c);
        let block = self.bits[off];
        (block & (1 << ind)) != 0
    }

    fn set(&mut self, r: CI, c: CI, val: bool) {
        let (ind, off) = self.get_index_offset(r, c);
        if val {
            self.bits[off] |= 1 << ind;
        } else {
            self.bits[off] &= !(1 << ind);
        }
    }

    /// Get the index of the first block for a column
    fn first_block(&self, c: CI) -> usize {
        self.blocks as usize * c as usize
    }

    fn add_cols(&mut self, c1: CI, c2: CI) {
        if c1 == c2 {
            // Adding a column to itself clears it.
            let off1 = self.first_block(c1);
            for i in 0..self.blocks {
                self.bits[off1 + i as usize] = 0;
            }
            return;
        }

        let off1 = self.first_block(c1);
        let off2 = self.first_block(c2);

        for i in 0..self.blocks {
            self.bits[off1 + i as usize] ^= self.bits[off2 + i as usize];
        }
    }

    fn colmax(&self, c: CI, row_perm: Option<&Permutation>) -> Option<CI> {
        if row_perm.is_none() {
            let off = self.first_block(c);
            for i in (0..self.blocks).rev() {
                let n = self.bits[off + i as usize];
                if n == 0 {
                    continue;
                }
                let num_offset = (64 * i) as CI;
                let z = 63 - n.leading_zeros() as CI;
                let number = num_offset + z;
                return Some(number);
            }
            return None;
        }
        let perm = row_perm.unwrap();

        let mut max: CI = -1;
        let mut ret: CI = -1;

        let off = self.first_block(c);
        for i in 0..self.blocks {
            let mut b = self.bits[off + i as usize];

            let block_start = (64 * i) as CI;
            while b != 0 {
                let z = 63 - b.leading_zeros() as CI;
                let pre_number = block_start + z;
                let post_number = perm.inv(pre_number);
                if max < post_number {
                    max = post_number;
                    ret = pre_number;
                }
                b ^= 1 << z; // Clear the lsb
            }
        }

        if ret == -1 {
            None
        } else {
            Some(ret)
        }
    }

    fn col_with_low(&self, r: CI, row_perm: Option<&Permutation>) -> Option<CI> {
        for c in 0..self.ncols() {
            if !self.get(r, c) {
                continue;
            }
            if self.colmax(c, row_perm) == Some(r) {
                return Some(c as CI);
            }
        }
        None
    }

    fn to_pairs(&self) -> Vec<(CI, CI)> {
        let mut pairs = Vec::new();
        for c in 0..self.ncols() {
            for bi in 0..self.blocks {
                let block_start = (64 * bi) as CI;
                let mut b = self.bits[self.first_block(c) + bi as usize];
                while b != 0 {
                    let z = b.trailing_zeros() as CI;
                    let r = block_start + z;
                    pairs.push((r, c));
                    b ^= 1 << z;
                }
            }
        }
        pairs
    }

    fn bottom_pad_with_identity(&mut self) {
        let rows = self.rows;
        let mut next = BitBuffer::new(
            self.nrows()
                .checked_mul(2)
                .expect("bottom_pad_with_identity: overflow when doubling matrix"),
            self.ncols(),
        );
        for (r, c) in self.to_pairs() {
            next.set(r, c, true);
        }
        for i in 0..rows {
            next.set(rows + i, i, true);
        }
        *self = next;
    }

    fn col_is_empty(&self, c: CI) -> bool {
        let off = self.first_block(c);
        for i in 0..self.blocks {
            let b = self.bits[off + i as usize];
            if b != 0 {
                return false;
            }
        }
        true
    }

    fn col_is_not_empty(&self, c: CI) -> bool {
        !self.col_is_empty(c)
    }

    fn col_as_vec(&self, c: CI) -> Vec<CI> {
        let mut v = Vec::new();
        for r in 0..self.nrows() {
            if self.get(r, c) {
                v.push(r);
            }
        }
        v
    }

    pub fn mem_usage(&self) -> usize {
        self.bits.capacity() * 8 + size_of_val(self)
    }

    fn fill_ratio(&self) -> f64 {
        let ones = self.bits.iter().map(|b| b.count_ones()).sum::<u32>();
        let size = self.nrows() as usize * self.ncols() as usize;
        dbg!(ones, size);
        ones as f64 / size as f64
    }
}

// type Backing = BitBuffer;
type Backing = Columns;
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SneakyMatrix {
    // pub columns: Vec<Col>,
    // pub rows: CI,
    // pub cols: CI,
    pub(crate) core: Backing,

    /// The column permutation.
    pub col_perm: Option<Permutation>,
    /// The row permutation.
    pub row_perm: Option<Permutation>,
}

impl SneakyMatrix {
    pub fn mem_usage(&self) -> usize {
        self.core.mem_usage()
            + self.col_perm.as_ref().map(|p| p.mem_usage()).unwrap_or(0)
            + self.row_perm.as_ref().map(|p| p.mem_usage()).unwrap_or(0)
    }

    pub fn fill_ratio(&self) -> f64 {
        self.core.fill_ratio()
    }

    pub fn count_empty_columns(&self) -> usize {
        (0..self.cols())
            .filter(|c| self.core.col_is_empty(*c))
            .count()
    }

    pub fn cols(&self) -> CI {
        self.core.ncols()
    }

    pub fn rows(&self) -> CI {
        self.core.nrows()
    }

    fn map_c(&self, c: CI) -> CI {
        self.col_perm.as_ref().map(|p| p.map(c)).unwrap_or(c)
    }

    fn map_r(&self, r: CI) -> CI {
        self.row_perm.as_ref().map(|p| p.map(r)).unwrap_or(r)
    }

    fn inv_c(&self, cc: CI) -> CI {
        self.col_perm.as_ref().map(|p| p.inv(cc)).unwrap_or(cc)
    }

    fn inv_r(&self, rr: CI) -> CI {
        self.row_perm.as_ref().map(|p| p.inv(rr)).unwrap_or(rr)
    }

    /// Returns all entries that are set as `(row, col)` pairs.
    pub fn to_pairs(&self) -> Vec<(CI, CI)> {
        self.core
            .to_pairs()
            .into_iter()
            .map(|(r, c)| (self.inv_r(r), self.inv_c(c)))
            .collect()
    }

    pub fn from_pairs(pairs: &[(CI, CI)], rows: CI, cols: CI) -> Self {
        let mut sm = Self::zeros(rows, cols);
        for &(r, c) in pairs {
            sm.set(r, c, true);
        }
        sm
    }

    pub fn transpose(&self) -> Self {
        let mut pairs = self.to_pairs();
        for (r, c) in pairs.iter_mut() {
            std::mem::swap(r, c);
        }
        Self::from_pairs(&pairs, self.core.nrows(), self.core.ncols())
    }

    /// Double the height of the matrix, and initialize the new block to be the identity.
    pub fn bottom_pad_with_identity(&mut self) {
        let rows = self.core.nrows();
        self.core.bottom_pad_with_identity();
        if self.row_perm.is_none() {
            self.row_perm = Some(Permutation::new(self.core.nrows()));
        }
        if let Some(p) = self.row_perm.as_mut() {
            p.push_n(rows);
        }
        for i in 0..rows {
            self.set(rows + i, i, true);
        }
    }

    pub fn gauss_jordan(&mut self) {
        let cols = self.core.ncols();
        for k in 0..cols {
            // Step 1: ensure that (k, k) = 1
            if !self.get(k, k) {
                let c = (k + 1..cols).find(|&kk| self.get(k, kk));
                if let Some(c) = c {
                    self.swap_cols(k, c);
                } else {
                    panic!("Matrix is not full rank");
                }
            }

            // Step 2: ensure all other columns are zero in the k-th row
            for c in 0..cols {
                if c == k {
                    continue;
                }
                if self.get(k, c) {
                    self.add_cols(c, k);
                }
            }
        }
    }

    pub fn extract_bottom_block_transpose(&self) -> Self {
        let mut pairs = Vec::new();
        let cols = self.core.ncols();
        let rows = self.core.nrows();

        let r0 = rows / 2;
        for c in 0..cols {
            let cc = self.map_c(c);
            for r in r0..rows {
                // NOTE: This is pretty inefficient. Better to loop through the ones that are there and skip the early rows.
                let rr = self.map_r(r);
                if self.core.get(rr, cc) {
                    pairs.push((c, r - r0));
                }
            }
        }
        Self::from_pairs(&pairs, r0, cols)
    }

    pub fn inverse_gauss_jordan(&mut self) -> Self {
        let mut sm_t = self.transpose();
        sm_t.bottom_pad_with_identity();
        sm_t.gauss_jordan();
        let result = sm_t.extract_bottom_block_transpose();
        return result;
    }

    /// Shuffle around the data of the matrix so that both the row- and column permutation are
    /// identity (i.e. [None]).
    pub fn bake_in_permutations(&mut self) {
        let pairs = self.core.to_pairs();
        self.core = Backing::from_pairs(
            self.rows(),
            self.cols(),
            &pairs
                .into_iter()
                .map(|(rr, cc)| (self.inv_r(rr), self.inv_c(cc)))
                .collect::<Vec<_>>(),
        );
        self.col_perm = None;
        self.row_perm = None;
    }

    pub fn zeros(rows: CI, cols: CI) -> Self {
        assert!(0 <= rows, "rows must be non-negative");
        assert!(0 <= cols, "rows must be non-negative");
        SneakyMatrix {
            core: Backing::new(rows, cols),
            col_perm: None,
            row_perm: None,
        }
    }

    pub fn eye(n: CI) -> Self {
        assert!(0 <= n, "dimension must be non-negative");
        SneakyMatrix {
            core: Backing::eye(n),
            col_perm: None,
            row_perm: None,
        }
    }

    pub fn __str__(&self) -> String {
        let mut s = String::new();
        let rows = self.core.nrows();
        let cols = self.core.ncols();
        for r in 0..rows {
            let rr = self.map_r(r);
            s.push('|');
            for c in 0..cols {
                let cc = self.map_c(c);
                if self.core.get(rr, cc) {
                    s.push('×');
                } else {
                    s.push(' ');
                }
            }
            s.push_str("|\n");
        }
        s
    }

    pub fn swap_rows(&mut self, a: CI, b: CI) {
        self.row_perm
            .get_or_insert_with(|| Permutation::new(self.core.nrows()))
            .swap(a, b);
    }

    pub fn swap_cols(&mut self, a: CI, b: CI) {
        self.col_perm
            .get_or_insert_with(|| Permutation::new(self.core.ncols()))
            .swap(a, b);
    }

    pub fn swap_cols_and_rows(&mut self, a: CI, b: CI) {
        self.swap_cols(a, b);
        self.swap_rows(a, b);
    }

    /// Add column `c2` into column `c1` in Z/Z2 arithmetic.
    pub fn add_cols(&mut self, c1: CI, c2: CI) {
        let cc1 = self.map_c(c1);
        let cc2 = self.map_c(c2);
        self.core.add_cols(cc1, cc2);
    }

    /// Searches for the lowest 1 in the given column. The returned row is under
    /// the row permutation, so it is the "logical" row.
    pub fn colmax(&self, c: CI) -> Option<CI> {
        let cc = self.map_c(c);
        self.core
            .colmax(cc, self.row_perm.as_ref())
            .map(|rr| self.inv_r(rr))
    }

    /// Search for the column which lowest one is the given `r`.
    pub fn col_with_low(&self, r: CI) -> Option<CI> {
        let rr = self.map_r(r);
        self.core
            .col_with_low(rr, self.row_perm.as_ref())
            .map(|cc| self.inv_c(cc))
    }

    /// Return `true` if the column is empty.
    pub fn col_is_empty(&self, c: CI) -> bool {
        self.core.col_is_empty(self.map_c(c as CI))
    }

    /// Return `true` if the column is not empty.
    pub fn col_is_not_empty(&self, c: CI) -> bool {
        self.core.col_is_not_empty(self.map_c(c))
    }

    pub fn set(&mut self, r: CI, c: CI, val: bool) {
        self.core.set(self.map_r(r), self.map_c(c), val)
    }

    pub fn get(&self, r: CI, c: CI) -> bool {
        self.core.get(self.map_r(r), self.map_c(c))
    }

    pub fn reduce(&mut self) -> Vec<(CI, CI)> {
        let mut adds = Vec::new();
        // Cache for already computd columns. `col_with_low[r] == c` means that `colmax(c) == r`.
        let mut col_with_low = vec![CI::MAX; self.core.nrows() as usize];

        for c in 0..self.core.ncols() {
            while let Some(max_in_col) = self.colmax(c) {
                let col_to_add = col_with_low[max_in_col as usize];
                if col_to_add == CI::MAX {
                    col_with_low[max_in_col as usize] = c;
                    break;
                }
                adds.push((c, col_to_add));
                self.add_cols(c, col_to_add);
            }
        }
        adds
    }

    /// Returns `true` if the column `c` gives birth to a new homology class.
    pub fn gives_birth(&self, c: CI) -> bool {
        self.col_is_empty(c)
    }
}

#[cfg(test)]
mod tests {
    use crate::complex;

    use super::*;

    #[test]
    fn column() {
        let c1: Col = vec![1, 2, 3, 4, 5].into(); // 1 through 5
        let c2: Col = vec![2, 4, 6, 8, 10].into(); // even below 10
        let c3: Col = vec![1, 3, 5, 7, 9].into(); // odds below 10

        assert_eq!(c1.add_mod2(&c2), vec![1, 3, 5, 6, 8, 10].into());
        assert_eq!(c2.add_mod2(&c1), vec![1, 3, 5, 6, 8, 10].into());
        assert_eq!(c1.add_mod2(&c3), vec![2, 4, 7, 9].into());
        assert_eq!(c3.add_mod2(&c1), vec![2, 4, 7, 9].into());

        assert_eq!(c2.add_mod2(&c3), vec![1, 2, 3, 4, 5, 6, 7, 8, 9, 10].into());
        assert_eq!(c3.add_mod2(&c2), vec![1, 2, 3, 4, 5, 6, 7, 8, 9, 10].into());
    }

    #[test]
    fn sneaky_matrix() {
        let mut sm = SneakyMatrix::zeros(3, 3);
        sm.set(1, 1, true);
        sm.swap_cols_and_rows(0, 1); // (0, 0) has the 1 now
        sm.add_cols(1, 0);
        sm.add_cols(2, 0);

        assert_eq!(sm.get(0, 0), true);
        assert_eq!(sm.get(0, 1), true);
        assert_eq!(sm.get(0, 2), true);

        sm = SneakyMatrix::zeros(3, 3);
        sm.set(1, 1, true);
        sm.swap_cols(0, 1); // (1, 0) has the 1 now
        sm.add_cols(1, 0);
        sm.add_cols(2, 0);
        assert_eq!(sm.get(1, 0), true);
        assert_eq!(sm.get(1, 1), true);
        assert_eq!(sm.get(1, 2), true);

        sm = SneakyMatrix::zeros(3, 3);
        sm.set(1, 1, true);
        sm.swap_rows(1, 0); // (0, 1) has the 1 now
        sm.add_cols(0, 1);
        sm.add_cols(2, 0);
        assert_eq!(sm.get(0, 0), true);
        assert_eq!(sm.get(0, 1), true);
        assert_eq!(sm.get(0, 2), true);
    }

    #[test]
    fn sneaky_matrix_col_swap() {
        let mut sm = SneakyMatrix::zeros(6, 1);
        sm.set(0, 0, true);

        sm.swap_rows(0, 1);
        assert!(sm.get(1, 0));
        sm.swap_rows(0, 2);
        assert!(sm.get(1, 0));
        sm.swap_rows(2, 1);
        assert!(sm.get(2, 0));
        sm.swap_rows(2, 3);
        assert!(sm.get(3, 0));
        sm.swap_rows(0, 3);
        assert!(sm.get(0, 0));
        sm.swap_rows(1, 4);
        assert!(sm.get(0, 0));
        sm.swap_rows(0, 4);
        assert!(sm.get(4, 0));
    }

    #[test]
    fn baking_permutations_works() {
        let mut sm = SneakyMatrix::zeros(6, 1);
        sm.set(0, 0, true);

        sm.swap_rows(0, 1);
        assert!(sm.get(1, 0));
        sm.swap_rows(0, 2);
        assert!(sm.get(1, 0));
        sm.swap_rows(2, 1);
        assert!(sm.get(2, 0));
        sm.swap_rows(2, 3);
        assert!(sm.get(3, 0));
        sm.swap_rows(0, 3);
        assert!(sm.get(0, 0));
        sm.swap_rows(1, 4);
        assert!(sm.get(0, 0));
        sm.swap_rows(0, 4);
        assert!(sm.get(4, 0));

        let mut baked = sm.clone();
        baked.bake_in_permutations();

        for r in 0..6 {
            assert_eq!(sm.get(r, 0), baked.get(r, 0));
        }
    }

    #[test]
    fn baking_gauss_test_works() {
        let mut sm = SneakyMatrix::zeros(4, 4);
        sm.set(0, 0, true);
        sm.set(0, 1, true);
        sm.set(0, 2, false);
        sm.set(0, 3, true);
        sm.set(1, 0, true);
        sm.set(1, 1, true);
        sm.set(1, 2, true);
        sm.set(1, 3, false);
        sm.set(2, 0, false);
        sm.set(2, 1, true);
        sm.set(2, 2, true);
        sm.set(2, 3, false);
        sm.set(3, 0, true);
        sm.set(3, 1, false);
        sm.set(3, 2, false);
        sm.set(3, 3, true);

        let mut sm_t = sm.transpose();
        sm_t.bottom_pad_with_identity();
        sm_t.gauss_jordan();

        let mut baked = sm_t.clone();
        baked.bake_in_permutations();
        for c in 0..4 {
            for r in 0..4 {
                assert_eq!(sm_t.get(r, c), baked.get(r, c));
            }
        }
    }

    #[test]
    fn reduce() {
        let mut sm =
            SneakyMatrix::from_pairs(&[(0, 0), (0, 1), (1, 1), (1, 2), (2, 0), (2, 2)], 3, 3);
        println!("matrix\n{}", sm.__str__());

        sm.reduce();
        println!("reduced\n{}", sm.__str__());
        let reduced = SneakyMatrix::from_pairs(&[(0, 0), (0, 1), (1, 1), (2, 0)], 3, 3);
        assert_eq!(sm.to_pairs(), reduced.to_pairs());
    }

    #[test]
    fn colmax() {
        let mut bb = SneakyMatrix::eye(4);
        println!("mat\n{}", bb.__str__());
        for i in 0..4 {
            assert_eq!(bb.colmax(i), Some(i));
        }
        bb.add_cols(0, 1);
        bb.add_cols(2, 0);
        bb.add_cols(1, 3);
        // |× × |
        // |××× |
        // |  × |
        // | × ×|

        println!("mat\n{}", bb.__str__());
        println!("col {:?}", bb.col_perm);
        println!("row {:?}", bb.row_perm);
        println!("core\n{:?}", bb.core);
        assert_eq!(bb.colmax(0), Some(1));
        assert_eq!(bb.colmax(1), Some(3));
        assert_eq!(bb.colmax(2), Some(2));
        assert_eq!(bb.colmax(3), Some(3));
    }

    #[test]
    fn gaussian_elimination() {
        let mut sm = SneakyMatrix::zeros(3, 3);
        sm.set(0, 0, false);
        sm.set(0, 1, true);
        sm.set(0, 2, true);

        sm.set(1, 0, true);
        sm.set(1, 1, true);
        sm.set(1, 2, false);

        sm.set(2, 0, false);
        sm.set(2, 1, true);
        sm.set(2, 2, false);

        let answer = SneakyMatrix::from_pairs(&[(0, 1), (0, 2), (1, 2), (2, 0), (2, 2)], 3, 3);

        println!("matrix:");
        println!("{}\n", sm.__str__());

        let mut sm_t = sm.transpose();
        println!("matrix T:");
        println!("{}\n", sm_t.__str__());

        sm_t.bottom_pad_with_identity();
        println!("with identity:");
        println!("{}\n", sm_t.__str__());

        sm_t.gauss_jordan();
        println!("after GJ:");
        println!("{}\n", sm_t.__str__());

        let result = sm_t.extract_bottom_block_transpose();
        println!("result:");
        println!("{}\n", result.__str__());

        println!("answer:");
        println!("{}\n", answer.__str__());
    }

    #[test]
    fn gaussian_elimination2() {
        let mut sm = SneakyMatrix::zeros(4, 4);
        sm.set(0, 0, true);
        sm.set(0, 1, true);
        sm.set(0, 2, false);
        sm.set(0, 3, true);
        sm.set(1, 0, true);
        sm.set(1, 1, true);
        sm.set(1, 2, true);
        sm.set(1, 3, false);
        sm.set(2, 0, false);
        sm.set(2, 1, true);
        sm.set(2, 2, true);
        sm.set(2, 3, false);
        sm.set(3, 0, true);
        sm.set(3, 1, false);
        sm.set(3, 2, false);
        sm.set(3, 3, true);

        let mut answer = SneakyMatrix::zeros(4, 4);
        answer.set(0, 0, false);
        answer.set(0, 1, true);
        answer.set(0, 2, true);
        answer.set(0, 3, false);
        answer.set(1, 0, true);
        answer.set(1, 1, false);
        answer.set(1, 2, false);
        answer.set(1, 3, true);
        answer.set(2, 0, true);
        answer.set(2, 1, false);
        answer.set(2, 2, true);
        answer.set(2, 3, true);
        answer.set(3, 0, false);
        answer.set(3, 1, true);
        answer.set(3, 2, true);
        answer.set(3, 3, true);

        println!("sm:");
        println!("{}\n", sm.__str__());

        let mut sm_t = sm.transpose();
        sm_t.bottom_pad_with_identity();
        sm_t.gauss_jordan();
        let result = sm_t.extract_bottom_block_transpose();
        println!("result:");
        println!("{}\n", result.__str__());

        println!("answer:");
        println!("{}\n", answer.__str__());
    }

    #[test]
    fn bitbuffer_construction() {
        let bb = BitBuffer::new(7, 4);
        dbg!(&bb);
        assert_eq!(bb.nrows(), 7);
        assert_eq!(bb.ncols(), 4);
        let bb = BitBuffer::new(63, 63);
        assert_eq!(bb.nrows(), 63);
        assert_eq!(bb.ncols(), 63);
        let bb = BitBuffer::new(64, 64);
        assert_eq!(bb.nrows(), 64);
        assert_eq!(bb.ncols(), 64);
        let bb = BitBuffer::new(65, 65);
        assert_eq!(bb.nrows(), 65);
        assert_eq!(bb.ncols(), 65);
    }

    #[test]
    fn bitbuffer_eye() {
        let bb = BitBuffer::eye(5);
        for i in 0..5 {
            assert!(bb.get(i, i), "diagonal wasn't set");
            for j in 0..5 {
                if i != j {
                    assert!(!bb.get(i, j), "off diagonal was set");
                }
            }
        }
    }

    #[test]
    fn bitbuffer_set_get() {
        let mut bb = BitBuffer::new(5, 5);

        bb.set(1, 3, true);
        assert!(bb.get(1, 3));
        bb.set(1, 3, false);
        assert!(!bb.get(1, 3));

        assert!(!bb.get(3, 2));
        bb.set(3, 2, true);
        assert!(bb.get(3, 2));

        assert!(!bb.get(0, 0));
        assert!(!bb.get(0, 4));
        assert!(!bb.get(4, 0));
        assert!(!bb.get(4, 4));

        bb.set(0, 0, true);
        bb.set(0, 4, true);
        bb.set(4, 0, true);
        bb.set(4, 4, true);

        assert!(bb.get(0, 0));
        assert!(bb.get(0, 4));
        assert!(bb.get(4, 0));
        assert!(bb.get(4, 4));
    }

    #[test]
    fn bitbuffer_writes_dont_leak() {
        let mut bb = BitBuffer::new(5, 5);

        bb.set(3, 3, true);
        assert_eq!(bb.get(2, 3), false);
        assert_eq!(bb.get(3, 3), true);
        assert_eq!(bb.get(4, 3), false);
        assert_eq!(bb.get(5, 3), false);

        bb.set(4, 3, true);
        assert_eq!(bb.get(2, 3), false);
        assert_eq!(bb.get(3, 3), true);
        assert_eq!(bb.get(4, 3), true);
        assert_eq!(bb.get(5, 3), false);

        bb.set(3, 3, false);
        assert_eq!(bb.get(2, 3), false);
        assert_eq!(bb.get(3, 3), false);
        assert_eq!(bb.get(4, 3), true);
        assert_eq!(bb.get(5, 3), false);

        bb.set(2, 3, true);
        assert_eq!(bb.get(2, 3), true);
        assert_eq!(bb.get(3, 3), false);
        assert_eq!(bb.get(4, 3), true);
        assert_eq!(bb.get(5, 3), false);
    }

    #[test]
    fn bitbuffer_add_cols() {
        let mut bb = BitBuffer::eye(5);

        bb.add_cols(0, 1); // [0]: 1 1 0 0 0
        assert_eq!(bb.get(0, 0), true);
        assert_eq!(bb.get(1, 0), true);
        assert_eq!(bb.get(2, 0), false);

        assert_eq!(bb.get(0, 1), false);
        assert_eq!(bb.get(1, 1), true);
        assert_eq!(bb.get(2, 1), false);

        bb.add_cols(2, 0);
        assert_eq!(bb.get(0, 2), true);
        assert_eq!(bb.get(1, 2), true);
        assert_eq!(bb.get(2, 2), true);
        assert_eq!(bb.get(3, 2), false);

        bb.add_cols(1, 1);
        assert_eq!(bb.get(0, 1), false);
        assert_eq!(bb.get(1, 1), false);
        assert_eq!(bb.get(2, 1), false);
    }

    #[test]
    fn bitbuffer_colmax_no_perm() {
        let bb = BitBuffer::eye(5);
        assert_eq!(bb.colmax(0, None), Some(0));
        assert_eq!(bb.colmax(1, None), Some(1));
        assert_eq!(bb.colmax(2, None), Some(2));
        assert_eq!(bb.colmax(3, None), Some(3));
        assert_eq!(bb.colmax(4, None), Some(4));
    }

    #[test]
    fn bitbuffer_colmax_perm() {
        let mut perm = Some(Permutation::new(5));
        let mut bb = BitBuffer::eye(5);
        for i in 0..5 {
            for j in i..5 {
                bb.set(i, j, true);
            }
        }
        assert_eq!(bb.colmax(0, perm.as_ref()), Some(0));
        assert_eq!(bb.colmax(1, perm.as_ref()), Some(1));
        assert_eq!(bb.colmax(2, perm.as_ref()), Some(2));
        assert_eq!(bb.colmax(3, perm.as_ref()), Some(3));
        assert_eq!(bb.colmax(4, perm.as_ref()), Some(4));

        perm = Some(Permutation::from_forwards(vec![4, 3, 2, 1, 0]));
        assert_eq!(bb.colmax(0, perm.as_ref()), Some(0));
        assert_eq!(bb.colmax(1, perm.as_ref()), Some(0));
        assert_eq!(bb.colmax(2, perm.as_ref()), Some(0));
        assert_eq!(bb.colmax(3, perm.as_ref()), Some(0));
        assert_eq!(bb.colmax(4, perm.as_ref()), Some(0));
    }

    #[test]
    fn bitbuffer_to_pairs() {
        let mut bb = BitBuffer::eye(5);
        for i in 0..5 {
            for j in i..5 {
                bb.set(i, j, true);
            }
        }
        let pairs = bb.to_pairs();
        for (a, b) in pairs {
            assert!(a <= b);
        }
    }

    #[test]
    fn bitbuffer_col_is_empty() {
        let mut bb = BitBuffer::eye(5);
        for i in 0..5 {
            assert_eq!(bb.col_is_empty(i), false);
        }
        bb.set(3, 3, false);
        assert_eq!(bb.col_is_empty(2), false);
        assert_eq!(bb.col_is_empty(3), true);
        assert_eq!(bb.col_is_empty(4), false);
    }

    #[test]
    fn bitbuffer_col_as_vec() {
        let bb = BitBuffer::eye(5);
        assert_eq!(bb.col_as_vec(0), &[0]);
        assert_eq!(bb.col_as_vec(1), &[1]);
        assert_eq!(bb.col_as_vec(2), &[2]);
    }

    #[test]
    fn snapshot_reduce() {
        let complex = crate::test::test_complex_cube();
        for dim in 0..3 {
            let mut boundary = complex.boundary_matrix(dim);
            let adds = boundary.reduce();
            insta::assert_snapshot!(boundary.__str__());
            insta::assert_json_snapshot!(adds);
        }
    }

    #[test]
    fn snapshot_reduce_with_perm() {
        let key_point = complex::Pos([0.1, 0.2, 0.3]);

        let complex = crate::test::test_complex_cube();
        let (v_perm, e_perm, _) = crate::compute_permutations(&complex, key_point);
        let mut boundary_0 = complex.boundary_matrix(0);
        boundary_0.col_perm = Some(v_perm.clone());
        let adds0 = boundary_0.reduce();
        insta::assert_snapshot!(boundary_0.__str__());
        insta::assert_json_snapshot!(adds0);

        let mut boundary_1 = complex.boundary_matrix(1);
        boundary_1.col_perm = Some(e_perm);
        boundary_1.row_perm = Some(v_perm);
        let adds1 = boundary_1.reduce();
        insta::assert_snapshot!(boundary_1.__str__());
        insta::assert_json_snapshot!(adds1);
    }
}
