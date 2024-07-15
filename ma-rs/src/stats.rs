use std::ops::Add;

#[derive(Debug, Default)]
pub struct SneakyMatrixMem {
    pub columns: usize,
    pub rows: usize,
    pub cols: usize,
    pub col_perm: usize,
    pub row_perm: usize,
}

impl Add for SneakyMatrixMem {
    type Output = SneakyMatrixMem;

    fn add(self, rhs: Self) -> Self::Output {
        Self {
            columns: self.columns + rhs.columns,
            rows: self.rows + rhs.rows,
            cols: self.cols + rhs.cols,
            col_perm: self.col_perm + rhs.col_perm,
            row_perm: self.row_perm + rhs.row_perm,
        }
    }
}

impl Into<SneakyMatrixMem> for &crate::sneaky_matrix::SneakyMatrix {
    fn into(self) -> SneakyMatrixMem {
        SneakyMatrixMem {
            columns: self.columns.iter().map(|v| v.mem_usage()).sum::<usize>(),
            rows: std::mem::size_of_val(&self.rows),
            cols: std::mem::size_of_val(&self.cols),
            col_perm: self.col_perm.mem_usage(),
            row_perm: self.col_perm.mem_usage(),
        }
    }
}

#[derive(Debug, Default)]
#[allow(non_snake_case)]
pub struct StackMem {
    pub D: SneakyMatrixMem,
    pub R: SneakyMatrixMem,
    pub U_t: SneakyMatrixMem,
    pub ordering: usize,
}

impl Add for StackMem {
    type Output = StackMem;

    fn add(self, rhs: Self) -> Self::Output {
        Self {
            D: self.D + rhs.D,
            R: self.R + rhs.R,
            U_t: self.U_t + rhs.U_t,
            ordering: self.ordering + rhs.ordering,
        }
    }
}

impl Into<StackMem> for &crate::Stack {
    fn into(self) -> StackMem {
        StackMem {
            D: (&self.D).into(),
            R: (&self.R).into(),
            U_t: (&self.U_t).into(),
            ordering: self.ordering.mem_usage(),
        }
    }
}

impl std::iter::Sum for StackMem {
    fn sum<I: Iterator<Item = Self>>(mut iter: I) -> Self {
        if let Some(mut s1) = iter.next() {
            while let Some(s) = iter.next() {
                s1 = s1 + s;
            }
            s1
        } else {
            Default::default()
        }
    }
}
