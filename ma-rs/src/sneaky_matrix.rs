use crate::permutation::Permutation;
use pyo3::prelude::PyObject;

#[derive(PartialEq, Eq, Debug, Clone)]
#[pyo3::pyclass]
pub struct Col(Vec<usize>);

#[pyo3::pymethods]
impl Col {
    #[staticmethod]
    fn new() -> Self {
        Col(Vec::new())
    }

    /// Checks if the column contains an entry at the given row.
    fn has(&self, a: usize) -> bool {
        self.0.binary_search(&a).is_ok()
    }

    /// Checks if the column is empty.
    fn empty(&self) -> bool {
        self.0.is_empty()
    }

    /// Set the given row.
    fn set(&mut self, r: usize) {
        match self.0.binary_search(&r) {
            Ok(_) => {}
            Err(i) => {
                self.0.insert(i, r);
            }
        }
    }

    /// Clear a row entry.
    fn unset(&mut self, r: usize) {
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
    fn max_under(&self, perm: &Permutation) -> Option<usize> {
        self.0.iter().max_by_key(|&&rr| perm.inv(rr)).cloned()
    }

    /// Turn the column into a `Vec<usize>` of row indices.
    pub fn as_vec(&self) -> Vec<usize> {
        self.0.clone()
    }
}

impl From<Vec<usize>> for Col {
    fn from(v: Vec<usize>) -> Self {
        Col(v)
    }
}

#[derive(Debug, Clone)]
#[pyo3::pyclass(get_all)]
pub struct SneakyMatrix {
    columns: Vec<Col>,
    pub rows: usize,
    pub cols: usize,

    /// The column permutation.
    pub col_perm: Permutation,
    /// The row permutation.
    pub row_perm: Permutation,
}

#[pyo3::pymethods]
impl SneakyMatrix {
    #[staticmethod]
    pub fn zeros(rows: usize, cols: usize) -> Self {
        let mut columns = Vec::with_capacity(cols);
        for _ in 0..cols {
            columns.push(Col::new());
        }

        SneakyMatrix {
            columns,
            rows,
            cols,
            col_perm: Permutation::new(cols),
            row_perm: Permutation::new(rows),
        }
    }

    #[staticmethod]
    pub fn eye(n: usize) -> Self {
        let mut columns = Vec::with_capacity(n);
        for i in 0..n {
            let mut v = Vec::with_capacity(1);
            v.push(i);
            columns.push(Col(v));
        }

        SneakyMatrix {
            columns,
            rows: n,
            cols: n,
            col_perm: Permutation::new(n),
            row_perm: Permutation::new(n),
        }
    }

    /// Assume that we can call `.cols` and `.rows` and index into the matrix,
    /// as well as a `.column(c)` method that returns a list of set rows.
    #[staticmethod]
    pub fn from_py_sneakymatrix(p: PyObject) -> Self {
        pyo3::Python::with_gil(|py| {
            let cols: usize = p.getattr(py, "cols").unwrap().extract(py).unwrap();
            let rows: usize = p.getattr(py, "rows").unwrap().extract(py).unwrap();
            let columns_fn = p.getattr(py, "columns").unwrap();
            let columns_ret = columns_fn.call0(py).unwrap();
            let columns: Vec<(usize, Vec<usize>)> = columns_ret.extract(py).unwrap();
            let mut z = Self::zeros(rows, cols);
            for (c, col) in columns.iter() {
                for &r in col.iter() {
                    z.set(r, *c, true);
                }
            }
            z
        })
    }

    pub fn swap_rows(&mut self, a: usize, b: usize) {
        self.row_perm.swap(a, b);
    }

    pub fn swap_cols(&mut self, a: usize, b: usize) {
        self.col_perm.swap(a, b);
    }

    pub fn swap_cols_and_rows(&mut self, a: usize, b: usize) {
        self.col_perm.swap(a, b);
        self.row_perm.swap(a, b);
    }

    /// Add column `c2` into column `c1` in Z/Z2 arithmetic.
    pub fn add_cols(&mut self, c1: usize, c2: usize) {
        let cc1 = self.col_perm.map(c1);
        let cc2 = self.col_perm.map(c2);
        let col_1 = &self.columns[cc1];
        let col_2 = &self.columns[cc2];
        let c3 = col_1.add_mod2(col_2);
        self.columns[cc1] = c3;
    }

    /// Searches for the lowest 1 in the given column. The returned row is under
    /// the row permutation, so it is the "logical" row.
    pub fn colmax(&self, c: usize) -> Option<usize> {
        let cc = self.col_perm.map(c);
        let col = &self.columns[cc];
        col.max_under(&self.row_perm)
    }

    /// Search for the column which lowest one is the given `r`.
    pub fn col_with_low(&self, r: usize) -> Option<usize> {
        let rr = self.row_perm.map(r);
        for (cc, col) in self.columns.iter().enumerate() {
            if col.max_under(&self.row_perm) == Some(rr) {
                let c = self.col_perm.inv(cc);
                return Some(c);
            }
        }
        None
    }

    /// Return [true] if the column is not empty.
    pub fn col_is_not_empty(&self, c: usize) -> bool {
        let cc = self.col_perm.map(c);
        !self.columns[cc].empty()
    }

    pub fn shape(&self) -> (usize, usize) {
        (self.rows, self.cols)
    }

    pub fn set(&mut self, r: usize, c: usize, val: bool) {
        let cc = self.col_perm.map(c);
        let rr = self.row_perm.map(r);
        if val {
            self.columns[cc].set(rr);
        } else {
            self.columns[cc].unset(rr);
        }
    }

    pub fn get(&mut self, r: usize, c: usize) -> bool {
        let cc = self.col_perm.map(c);
        let rr = self.row_perm.map(r);
        self.columns[cc].has(rr)
    }

    pub fn clone2(&self) -> Self {
        self.clone()
    }

    /// Reduces the matrix.
    pub fn reduce(&mut self) -> Vec<(usize, usize)> {
        let mut adds = Vec::new();
        for c in 0..self.cols {
            if !self.col_is_not_empty(c) {
                continue;
            }

            'outer: loop {
                let low = self.colmax(c);
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
}
