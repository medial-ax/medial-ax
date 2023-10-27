#[derive(Debug, Clone)]
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
struct Col(Vec<usize>);

impl Col {
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
}

impl From<Vec<usize>> for Col {
    fn from(v: Vec<usize>) -> Self {
        Col(v)
    }
}

#[derive(Debug, Clone)]
pub struct SneakyMatrix {
    columns: Vec<Col>,
    pub rows: usize,
    pub cols: usize,

    col_perm: Permutation,
    row_perm: Permutation,
}

impl SneakyMatrix {
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
            if col.has(rr) {
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
}
