use std::iter::zip;

use pyo3::prelude::*;

#[derive(Debug, Clone)]
#[pyclass]
pub struct Permutation {
    forwards: Vec<usize>,
    backwards: Vec<usize>,
}

impl Permutation {
    pub fn new(n: usize) -> Self {
        Permutation {
            forwards: (0..n).collect(),
            backwards: (0..n).collect(),
        }
    }

    pub fn map(&self, a: usize) -> usize {
        self.forwards[a]
    }

    pub fn inv(&self, a: usize) -> usize {
        self.backwards[a]
    }

    /// Apply the swap to the "end" of the permutation.
    /// ```rust
    /// # use ma_rs::Permutation;
    /// let mut p = Permutation::new(10);
    /// p.swap(2, 3);
    /// assert_eq!(p.map(0), 0);
    /// assert_eq!(p.map(1), 1);
    /// assert_eq!(p.map(2), 3);
    /// assert_eq!(p.map(3), 2);
    /// p.swap(3, 1);
    /// assert_eq!(p.map(0), 0);
    /// assert_eq!(p.map(1), 2);
    /// assert_eq!(p.map(2), 3);
    /// assert_eq!(p.map(3), 1);
    /// ```
    pub fn swap(&mut self, a: usize, b: usize) {
        self.forwards.swap(a, b);
        self.backwards.swap(self.forwards[a], self.forwards[b]);
    }

    pub fn len(&self) -> usize {
        self.forwards.len()
    }
}

#[derive(PartialEq, Eq, Debug, Clone)]
#[pyclass]
struct Col(Vec<usize>);

#[pymethods]
impl Col {
    #[staticmethod]
    fn new() -> Self {
        Col(Vec::new())
    }

    fn has(&self, a: usize) -> bool {
        self.0.binary_search(&a).is_ok()
    }

    fn empty(&self) -> bool {
        self.0.is_empty()
    }

    fn add(&mut self, a: usize) {
        match self.0.binary_search(&a) {
            Ok(_) => {}
            Err(i) => {
                self.0.insert(i, a);
            }
        }
    }

    fn remove(&mut self, a: usize) {
        match self.0.binary_search(&a) {
            Ok(i) => {
                self.0.remove(i);
            }
            Err(_) => {}
        }
    }

    fn union(&self, other: &Self) -> Self {
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
#[pyclass(get_all)]
pub struct SneakyMatrix {
    columns: Vec<Col>,
    pub rows: usize,
    pub cols: usize,

    col_perm: Permutation,
    row_perm: Permutation,
}

#[pymethods]
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
        Python::with_gil(|py| {
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

    pub fn add_cols(&mut self, c1: usize, c2: usize) {
        let cc1 = self.col_perm.map(c1);
        let cc2 = self.col_perm.map(c2);
        let col_1 = &self.columns[cc1];
        let col_2 = &self.columns[cc2];
        let c3 = col_1.union(col_2);
        self.columns[cc1] = c3;
    }

    /// Searches for the lowest 1 in the given column. The returned row is under
    /// the row permutation, so it is the "logical" row.
    pub fn colmax(&self, c: usize) -> Option<usize> {
        let cc = self.col_perm.map(c);
        let col = &self.columns[cc];
        col.max_under(&self.row_perm)
    }

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
            self.columns[cc].add(rr);
        } else {
            self.columns[cc].remove(rr);
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
}

const _TRUE: bool = true;
const _FALSE: bool = false;
impl std::ops::Index<(usize, usize)> for SneakyMatrix {
    type Output = bool;

    fn index(&self, (r, c): (usize, usize)) -> &Self::Output {
        let rr = self.row_perm.map(r);
        let cc = self.col_perm.map(c);
        if self.columns[cc].has(rr) {
            &_TRUE
        } else {
            &_FALSE
        }
    }
}

#[allow(non_snake_case)]
fn perform_one_swap(i: usize, R: &mut SneakyMatrix, U_t: &mut SneakyMatrix) -> Option<bool> {
    #[allow(non_snake_case)]
    fn gives_death(R: &mut SneakyMatrix, c: usize) -> bool {
        R.col_is_not_empty(c)
    }

    #[allow(non_snake_case)]
    fn low(R: &mut SneakyMatrix, c: usize) -> Option<usize> {
        R.colmax(c)
    }

    #[allow(non_snake_case)]
    fn low_inv(R: &mut SneakyMatrix, r: usize) -> Option<usize> {
        R.col_with_low(r)
    }

    let gives_death_i = gives_death(R, i);
    let gives_birth_i = !gives_death_i;
    let gives_death_i_1 = gives_death(R, i + 1);
    let gives_birth_i_1 = !gives_death_i_1;

    // println!(
    //     "gives_death_i: {}, gives_birth_i: {}, gives_death_i_1: {}, gives_birth_i_1: {}",
    //     gives_death_i, gives_birth_i, gives_death_i_1, gives_birth_i_1
    // );

    // if gives_birth_i and gives_birth_i_1:
    if gives_birth_i && gives_birth_i_1 {
        // U_t[i + 1, i] = 0
        U_t.set(i + 1, i, false);
        // k = low_inv(i)
        let k = low_inv(R, i);
        // l = low_inv(i + 1)
        let l = low_inv(R, i + 1);
        // if k != None and l != None and R[i, l] == 1:
        if let (Some(k), Some(l)) = (k, l) {
            if R.get(i, l) {
                // if k < l:
                if k < l {
                    // R.swap_cols_and_rows(i, i + 1)  # PRP
                    R.swap_cols_and_rows(i, i + 1);
                    // R.add_cols(l, k)  # PRPV
                    R.add_cols(l, k);
                    // U_t.swap_cols_and_rows(i, i + 1)  # PUP
                    U_t.swap_cols_and_rows(i, i + 1);
                    // U_t.add_cols(k, l)  # VPUP
                    U_t.add_cols(k, l);
                    // return (R, U_t, None)
                    return None;
                }
                // if l < k:
                if l < k {
                    // R.swap_cols_and_rows(i, i + 1)  # PRP
                    R.swap_cols_and_rows(i, i + 1);
                    // R.add_cols(k, l)  # PRPV
                    R.add_cols(k, l);
                    // U_t.swap_cols_and_rows(i, i + 1)  # PUP
                    U_t.swap_cols_and_rows(i, i + 1);
                    // U_t.add_cols(l, k)  # VPUP
                    U_t.add_cols(l, k);
                    // return (R, U_t, False)
                    return Some(false);
                }
                panic!("This should never happen: l == k ({})", l);
                // raise Exception("k = l; This should never happen.")
                // else:
            }
        }

        // else case
        // R.swap_cols_and_rows(i, i + 1)  # PRP
        R.swap_cols_and_rows(i, i + 1);
        // U_t.swap_cols_and_rows(i, i + 1)  # PUP
        U_t.swap_cols_and_rows(i, i + 1);
        // return (R, U_t, None)
        return None;
    }
    // if gives_death_i and gives_death_i_1:
    if gives_death_i && gives_death_i_1 {
        // if U_t[i + 1, i] == 1:
        if U_t.get(i + 1, i) {
            // low_i = low(i)
            let low_i = low(R, i);
            // low_i_1 = low(i + 1)
            let low_i_1 = low(R, i + 1);
            // U_t.add_cols(i, i + 1)  # W U
            U_t.add_cols(i, i + 1);
            // R.add_cols(i + 1, i)  # R W
            R.add_cols(i + 1, i);
            // R.swap_cols_and_rows(i, i + 1)  # P R W P
            R.swap_cols_and_rows(i, i + 1);
            // U_t.swap_cols_and_rows(i, i + 1)  # P W U P
            U_t.swap_cols_and_rows(i, i + 1);
            // if low_i < low_i_1:
            if low_i < low_i_1 {
                // return (R, U_t, None)
                return None;
            // else:
            } else {
                // R.add_cols(i + 1, i)  # (P R W P) W
                R.add_cols(i + 1, i);
                // U_t.add_cols(i, i + 1)  # W (P W U P)
                U_t.add_cols(i, i + 1);
                // return (R, U_t, False)
                return Some(false);
            }
        // else:
        } else {
            // R.swap_cols_and_rows(i, i + 1)  # P R P
            R.swap_cols_and_rows(i, i + 1);
            // U_t.swap_cols_and_rows(i, i + 1)  # P U P
            U_t.swap_cols_and_rows(i, i + 1);
            // return (R, U_t, None)
            return None;
        }
    }
    // if gives_death_i and gives_birth_i_1:
    if gives_death_i && gives_birth_i_1 {
        // if U_t[i + 1, i] == 1:
        if U_t.get(i + 1, i) {
            // U_t.add_cols(i, i + 1)  # W U
            U_t.add_cols(i, i + 1);
            // R.add_cols(i + 1, i)  # R W
            R.add_cols(i + 1, i);
            // R.swap_cols_and_rows(i, i + 1)  # P R W P
            R.swap_cols_and_rows(i, i + 1);
            // R.add_cols(i + 1, i)  # (P R W P) W
            R.add_cols(i + 1, i);
            // U_t.swap_cols_and_rows(i, i + 1)  # P W U P
            U_t.swap_cols_and_rows(i, i + 1);
            // U_t.add_cols(i, i + 1)  # W (P W U P)
            U_t.add_cols(i, i + 1);
            // return (R, U_t, True)
            return Some(true);
        // else:
        } else {
            // R.swap_cols_and_rows(i, i + 1)  # P R P
            R.swap_cols_and_rows(i, i + 1);
            // U_t.swap_cols_and_rows(i, i + 1)  # P U P
            U_t.swap_cols_and_rows(i, i + 1);
            // return (R, U_t, None)
            return None;
        }
    }
    // if gives_birth_i and gives_death_i_1:
    if gives_birth_i && gives_death_i_1 {
        // U_t[i + 1, i] = 0
        U_t.set(i + 1, i, false);
        // R.swap_cols_and_rows(i, i + 1)  # P R P
        R.swap_cols_and_rows(i, i + 1);
        // U_t.swap_cols_and_rows(i, i + 1)  # P U P
        U_t.swap_cols_and_rows(i, i + 1);
        // return (R, U_t, None)
        return None;
    }

    // raise Exception("bottom of the function; This should never happen.")
    panic!("This should never happen: no cases matched.");
}

/// Perform all the swaps in `index_swaps`. Return a [Vec] of the indices into
/// `index_swaps` that were Faustian swaps.
#[allow(non_snake_case)]
#[pyfunction]
pub fn vine_to_vine(
    D: &mut SneakyMatrix,
    R: &mut SneakyMatrix,
    U_t: &mut SneakyMatrix,
    index_swaps: Vec<usize>,
) -> Vec<usize> {
    let mut ret = Vec::new();
    for (swap_i, &i) in index_swaps.iter().enumerate() {
        let res = perform_one_swap(i, R, U_t);
        D.swap_cols_and_rows(i, i + 1);
        if let Some(true) = res {
            ret.push(swap_i);
        }
    }
    ret
}

/// Compute the transpositions required to swap one sequence to the other.  
/// Assume that the vectors `a` and `b` contains unique and identical elements.
/// Compute the transpositions required to swap `a` to `b` as a list of numbers,
/// where `i` correspond to the transposition of `a[i]` and `a[i+1]`.
#[pyfunction]
pub fn compute_transpositions(mut a: Vec<usize>) -> (Vec<usize>, Vec<(usize, usize)>) {
    let n = a.len();
    let n0 = zip(&a, 0..n).position(|(&aa, bb)| aa != bb).unwrap_or(n);
    let n1 = zip(&a, 0..n).rposition(|(&aa, bb)| aa != bb).unwrap_or(n);
    let mut ret = Vec::with_capacity(n);
    let mut swapped_indices = Vec::with_capacity(n);
    for _ in n0..=n1 {
        let mut swap = false;
        for i in 0..(n - 1) {
            if a[i] > a[i + 1] {
                ret.push(i);
                a.swap(i, i + 1);
                swapped_indices.push((a[i], a[i + 1]));
                swap = true;
            }
        }
        if !swap {
            break;
        }
    }
    (ret, swapped_indices)
}

#[allow(non_snake_case)]
#[pyfunction]
pub fn reduce_vine(
    ordering: Vec<usize>,
    R: &mut SneakyMatrix,
    D: &mut SneakyMatrix,
    U_t: &mut SneakyMatrix,
) -> Vec<(usize, usize)> {
    let (swapped_indices, swapped_simplices) = compute_transpositions(ordering);
    let faustians = vine_to_vine(D, R, U_t, swapped_indices);
    faustians
        .into_iter()
        .map(|i| swapped_simplices[i])
        .collect::<Vec<_>>()
}

#[pymodule]
fn mars(_py: Python, m: &PyModule) -> PyResult<()> {
    m.add_function(wrap_pyfunction!(vine_to_vine, m)?)?;
    m.add_function(wrap_pyfunction!(compute_transpositions, m)?)?;
    m.add_function(wrap_pyfunction!(reduce_vine, m)?)?;
    m.add_class::<SneakyMatrix>()?;
    m.add_class::<Permutation>()?;
    m.add_class::<Col>()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn permutation() {
        fn test_inverse(p: &Permutation) {
            for i in 0..p.len() {
                assert_eq!(p.inv(p.map(i)), i);
                assert_eq!(p.map(p.inv(i)), i);
            }
        }

        let mut p = Permutation::new(10);

        for i in 0..p.len() {
            assert_eq!(p.map(i), i);
        }
        test_inverse(&p);

        p.swap(2, 3);

        assert_eq!(p.map(0), 0);
        assert_eq!(p.map(1), 1);
        assert_eq!(p.map(2), 3);
        assert_eq!(p.map(3), 2);

        assert_eq!(p.inv(0), 0);
        assert_eq!(p.inv(1), 1);
        assert_eq!(p.inv(2), 3);
        assert_eq!(p.inv(3), 2);
        test_inverse(&p);

        p.swap(1, 2);

        assert_eq!(p.map(0), 0);
        assert_eq!(p.map(1), 3);
        assert_eq!(p.map(2), 1);
        assert_eq!(p.map(3), 2);

        assert_eq!(p.inv(0), 0);
        assert_eq!(p.inv(1), 2);
        assert_eq!(p.inv(2), 3);
        assert_eq!(p.inv(3), 1);
        test_inverse(&p);
    }

    #[test]
    fn column() {
        let c1 = Col::from(vec![1, 2, 3, 4, 5]); // 1 through 5
        let c2 = Col::from(vec![2, 4, 6, 8, 10]); // even below 10
        let c3 = Col::from(vec![1, 3, 5, 7, 9]); // odds below 10

        assert_eq!(c1.union(&c2), Col::from(vec![1, 3, 5, 6, 8, 10]));
        assert_eq!(c2.union(&c1), Col::from(vec![1, 3, 5, 6, 8, 10]));
        assert_eq!(c1.union(&c3), Col::from(vec![2, 4, 7, 9]));
        assert_eq!(c3.union(&c1), Col::from(vec![2, 4, 7, 9]));

        assert_eq!(
            c2.union(&c3),
            Col::from(vec![1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
        );
        assert_eq!(
            c3.union(&c2),
            Col::from(vec![1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
        );
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
    fn test_compute_transpositions() {
        let a = vec![0, 1, 4, 3, 2, 5];
        // [0, 1, 4, 3, 2, 5]  start
        // [0, 1, 3, 4, 2, 5]  swapped 2 and 3
        // [0, 1, 3, 2, 4, 5]  swapped 3 and 4
        // [0, 1, 2, 3, 4, 5]  swapped 2 and 3
        let res = compute_transpositions(a);
        assert_eq!(res.0, vec![2, 3, 2]);

        let a = vec![3, 4, 5, 2, 0, 1];
        // [3, 4, 5, 2, 0, 1]  start
        // [3, 4, 2, 5, 0, 1]  2
        // [3, 4, 2, 0, 5, 1]  3
        // [3, 4, 2, 0, 1, 5]  4
        // [3, 2, 4, 0, 1, 5]  1
        // [3, 2, 0, 4, 1, 5]  2
        // [3, 2, 0, 1, 4, 5]  3
        // [2, 3, 0, 1, 4, 5]  0
        // [2, 0, 3, 1, 4, 5]  1
        // [2, 0, 1, 3, 4, 5]  2
        // [0, 2, 1, 3, 4, 5]  0
        // [0, 1, 2, 3, 4, 5]  1
        let res = compute_transpositions(a);
        assert_eq!(res.0, vec![2, 3, 4, 1, 2, 3, 0, 1, 2, 0, 1]);

        let a = vec![0, 1, 2, 4, 5, 6, 7, 3, 8, 9, 10, 11];
        let res = compute_transpositions(a);
        assert_eq!(res.0, vec![6, 5, 4, 3]);
    }
}
