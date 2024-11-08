use std::{collections::HashMap, ops::Add};

#[derive(Debug, Default)]
pub struct SneakyMatrixMem {
    /// The size of the [Col] objects, as stored in [SneakyMatrix::columns].
    /// This includes the pointers, the capacity counts, etc. for all columns.
    pub column_meta: usize,
    /// The size of the [Vec]s in [Col].
    /// These are just the indices stored in the column.
    pub column_items: usize,
    /// Size of the field rows
    pub rows: usize,
    pub cols: usize,
    /// Size of the permutation
    pub col_perm: usize,
    pub row_perm: usize,
}

impl Add for SneakyMatrixMem {
    type Output = SneakyMatrixMem;

    fn add(self, rhs: Self) -> Self::Output {
        Self {
            column_meta: self.column_meta + rhs.column_meta,
            column_items: self.column_items + rhs.column_items,
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
            column_meta: self.columns.capacity() * std::mem::size_of::<crate::sneaky_matrix::Col>(),
            column_items: self.columns.iter().map(|v| v.mem_usage()).sum::<usize>(),
            rows: std::mem::size_of_val(&self.rows),
            cols: std::mem::size_of_val(&self.cols),
            col_perm: self.col_perm.as_ref().map(|p| p.mem_usage()).unwrap_or(0),
            row_perm: self.col_perm.as_ref().map(|p| p.mem_usage()).unwrap_or(0),
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

#[derive(Debug, Default)]
pub struct ReductionMem {
    pub stacks: [StackMem; 3],
}

impl Into<ReductionMem> for &crate::Reduction {
    fn into(self) -> ReductionMem {
        ReductionMem {
            stacks: [
                (&self.stacks[0]).into(),
                (&self.stacks[1]).into(),
                (&self.stacks[2]).into(),
            ],
        }
    }
}

#[derive(Debug, Default)]
pub struct SwapsMem {
    v: usize,
}

impl Into<SwapsMem> for &crate::Swaps {
    fn into(self) -> SwapsMem {
        SwapsMem {
            v: self.v.capacity() * size_of::<crate::Swap>(),
        }
    }
}

impl std::iter::Sum for SwapsMem {
    fn sum<I: Iterator<Item = Self>>(mut iter: I) -> Self {
        if let Some(mut s1) = iter.next() {
            while let Some(s) = iter.next() {
                s1.v += s.v;
            }
            s1
        } else {
            Default::default()
        }
    }
}

#[derive(Debug, Default)]
pub struct VineyardsMem {
    reductions: HashMap<crate::Index, ReductionMem>,
    swaps: [usize; 3],
}

impl Into<VineyardsMem> for &crate::Vineyards {
    fn into(self) -> VineyardsMem {
        VineyardsMem {
            reductions: self
                .reductions
                .iter()
                .map(|(k, v)| (*k, v.into()))
                .collect(),
            swaps: [
                self.swaps[0]
                    .iter()
                    .map(|(_, _, v)| Into::<SwapsMem>::into(v).v)
                    .sum::<usize>(),
                self.swaps[1]
                    .iter()
                    .map(|(_, _, v)| Into::<SwapsMem>::into(v).v)
                    .sum::<usize>(),
                self.swaps[2]
                    .iter()
                    .map(|(_, _, v)| Into::<SwapsMem>::into(v).v)
                    .sum::<usize>(),
            ],
        }
    }
}
