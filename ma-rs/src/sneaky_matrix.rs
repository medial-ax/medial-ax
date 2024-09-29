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
    fn has(&self, a: CI) -> bool {
        self.0.binary_search(&a).is_ok()
    }

    /// Checks if the column is empty.
    fn empty(&self) -> bool {
        self.0.is_empty()
    }

    /// Set the given row.
    fn set(&mut self, r: CI) {
        match self.0.binary_search(&r) {
            Ok(_) => {}
            Err(i) => {
                self.0.insert(i, r);
            }
        }
    }

    /// Clear a row entry.
    fn unset(&mut self, r: CI) {
        match self.0.binary_search(&r) {
            Ok(i) => {
                self.0.remove(i);
            }
            Err(_) => {}
        }
    }

    /// Add in another column in Z/Z2 arithmetic.
    fn add_mod2(&self, other: &Self) -> Self {
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
    fn max_under(&self, perm: Option<&Permutation>) -> Option<CI> {
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

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct SneakyMatrix {
    pub columns: Vec<Col>,
    pub rows: CI,
    pub cols: CI,

    /// The column permutation.
    pub col_perm: Option<Permutation>,
    /// The row permutation.
    pub row_perm: Option<Permutation>,
}

impl SneakyMatrix {
    pub fn mem_usage(&self) -> usize {
        self.columns.iter().map(|c| c.mem_usage()).sum::<usize>()
            + 2 * std::mem::size_of_val(&self.rows)
            + self.col_perm.as_ref().map(|p| p.mem_usage()).unwrap_or(0)
            + self.row_perm.as_ref().map(|p| p.mem_usage()).unwrap_or(0)
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
        let mut pairs = Vec::new();
        for c in 0..self.cols {
            let cc = self.map_c(c);
            for r in 0..self.rows {
                let rr = self.map_r(r);
                if self.columns[cc as usize].has(rr) {
                    pairs.push((r, c));
                }
            }
        }
        pairs
    }

    pub fn from_pairs(pairs: Vec<(CI, CI)>, rows: CI, cols: CI) -> Self {
        let mut sm = Self::zeros(rows, cols);
        for (r, c) in pairs {
            sm.set(r, c, true);
        }
        sm
    }

    pub fn transpose(&self) -> Self {
        let mut pairs = self.to_pairs();
        for (r, c) in pairs.iter_mut() {
            std::mem::swap(r, c);
        }
        Self::from_pairs(pairs, self.rows, self.cols)
    }

    pub fn bottom_pad_with_identity(&mut self) {
        let rows = self.rows;
        self.rows *= 2;
        if self.row_perm.is_none() {
            self.row_perm = Some(Permutation::new(self.rows));
        }
        self.row_perm.as_mut().unwrap().push_n(rows);
        for i in 0..rows {
            self.set(rows + i, i, true);
        }
    }

    pub fn gauss_jordan(&mut self) {
        for k in 0..self.cols {
            // Step 1: ensure that (k, k) = 1
            if !self.get(k, k) {
                let c = (k + 1..self.cols).find(|&kk| self.get(k, kk));
                if let Some(c) = c {
                    self.swap_cols(k, c);
                } else {
                    panic!("Matrix is not full rank");
                }
            }

            // Step 2: ensure all other columns are zero in the k-th row
            for c in 0..self.cols {
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

        let r0 = self.rows / 2;
        for c in 0..self.cols {
            let cc = self.map_c(c);
            for r in r0..self.rows {
                // NOTE: This is pretty inefficient. Better to loop through the ones that are there and skip the early rows.
                let rr = self.map_r(r);
                if self.columns[cc as usize].has(rr) {
                    pairs.push((c, r - r0));
                }
            }
        }
        Self::from_pairs(pairs, r0, self.cols)
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
        let mut cols = vec![Col::new(); self.cols as usize];
        for c in 0..self.cols {
            let cc = self.map_c(c);
            let mut col = self.columns[cc as usize].as_vec();
            for rr in col.iter_mut() {
                *rr = self.inv_r(*rr);
            }
            col.sort();
            cols[c as usize] = col.into();
        }
        self.columns = cols;
        self.col_perm = None;
        self.row_perm = None;
    }
}

impl SneakyMatrix {
    pub fn zeros(rows: CI, cols: CI) -> Self {
        let mut columns = Vec::with_capacity(cols as usize);
        for _ in 0..cols {
            columns.push(Col::new());
        }

        SneakyMatrix {
            columns,
            rows,
            cols,
            col_perm: None,
            row_perm: None,
        }
    }

    pub fn eye(n: CI) -> Self {
        let mut columns = Vec::with_capacity(n as usize);
        for i in 0..n {
            let mut v = Vec::with_capacity(1);
            v.push(i);
            columns.push(Col(v));
        }

        SneakyMatrix {
            columns,
            rows: n,
            cols: n,
            col_perm: None,
            row_perm: None,
        }
    }

    pub fn __str__(&self) -> String {
        let mut s = String::new();
        for r in 0..self.rows {
            let rr = self.map_r(r);
            s.push('|');
            for c in 0..self.cols {
                let cc = self.map_c(c);
                if self.columns[cc as usize].has(rr) {
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
            .get_or_insert_with(|| Permutation::new(self.rows))
            .swap(a, b);
    }

    pub fn swap_cols(&mut self, a: CI, b: CI) {
        self.col_perm
            .get_or_insert_with(|| Permutation::new(self.cols))
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
        let col_1 = &self.columns[cc1 as usize];
        let col_2 = &self.columns[cc2 as usize];
        let c3 = col_1.add_mod2(col_2);
        self.columns[cc1 as usize] = c3;
    }

    /// Searches for the lowest 1 in the given column. The returned row is under
    /// the row permutation, so it is the "logical" row.
    pub fn colmax(&self, c: CI) -> Option<CI> {
        let cc = self.map_c(c);
        let col = &self.columns[cc as usize];
        col.max_under(self.row_perm.as_ref())
            .map(|rr| self.inv_r(rr))
    }

    /// Search for the column which lowest one is the given `r`.
    pub fn col_with_low(&self, r: CI) -> Option<CI> {
        let rr = self.map_r(r);
        for (cc, col) in self.columns.iter().enumerate() {
            if col.max_under(self.row_perm.as_ref()) == Some(rr) {
                let c = self.inv_c(cc as CI);
                return Some(c);
            }
        }
        None
    }

    /// Return `true` if the column is empty.
    pub fn col_is_empty(&self, c: CI) -> bool {
        let cc = self.map_c(c);
        self.columns[cc as usize].empty()
    }

    /// Return `true` if the column is not empty.
    pub fn col_is_not_empty(&self, c: CI) -> bool {
        let cc = self.map_c(c);
        !self.columns[cc as usize].empty()
    }

    /// `(rows, cols)`
    pub fn shape(&self) -> (CI, CI) {
        (self.rows, self.cols)
    }

    pub fn set(&mut self, r: CI, c: CI, val: bool) {
        let cc = self.map_c(c);
        let rr = self.map_r(r);
        if val {
            self.columns[cc as usize].set(rr);
        } else {
            self.columns[cc as usize].unset(rr);
        }
    }

    pub fn get(&self, r: CI, c: CI) -> bool {
        let cc = self.map_c(c);
        let rr = self.map_r(r);
        self.columns[cc as usize].has(rr)
    }

    pub fn clone2(&self) -> Self {
        self.clone()
    }

    /// Reduces the matrix.
    pub fn reduce(&mut self) -> Vec<(CI, CI)> {
        // NOTE: it might be faster to reduce a matrix if we have the reduced
        // matrix of the dimension above.
        let mut adds = Vec::new();
        for c in 0..self.cols {
            if !self.col_is_not_empty(c) {
                continue;
            }

            'outer: loop {
                let low = self.colmax(c);
                if low.is_none() {
                    break;
                }
                for cc in 0..c {
                    let cc_low = self.colmax(cc);
                    if cc_low == low {
                        adds.push((c, cc));
                        self.add_cols(c, cc);
                        continue 'outer;
                    }
                }
                break;
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

        let answer = SneakyMatrix::from_pairs(vec![(0, 1), (0, 2), (1, 2), (2, 0), (2, 2)], 3, 3);

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
}
