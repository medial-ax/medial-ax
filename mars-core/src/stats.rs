use std::{collections::HashMap, ops::Add};

use crate::{complex, sneaky_matrix::CI, Grid, Mars};

#[derive(Debug, Default, Clone)]
pub struct SneakyMatrixMem {
    pub core: usize,
    /// Size of the permutation
    pub col_perm: usize,
    pub row_perm: usize,
}

impl Add for SneakyMatrixMem {
    type Output = SneakyMatrixMem;

    fn add(self, rhs: Self) -> Self::Output {
        Self {
            core: self.core + rhs.core,
            col_perm: self.col_perm + rhs.col_perm,
            row_perm: self.row_perm + rhs.row_perm,
        }
    }
}

impl Into<SneakyMatrixMem> for &crate::sneaky_matrix::SneakyMatrix {
    fn into(self) -> SneakyMatrixMem {
        SneakyMatrixMem {
            core: self.core.mem_usage(),
            col_perm: self.col_perm.as_ref().map(|p| p.mem_usage()).unwrap_or(0),
            row_perm: self.col_perm.as_ref().map(|p| p.mem_usage()).unwrap_or(0),
        }
    }
}

#[derive(Debug, Default, Clone)]
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

impl Add for ReductionMem {
    type Output = ReductionMem;

    fn add(self, rhs: Self) -> Self::Output {
        Self {
            stacks: [
                self.stacks[0].clone() + rhs.stacks[0].clone(),
                self.stacks[1].clone() + rhs.stacks[1].clone(),
                self.stacks[2].clone() + rhs.stacks[2].clone(),
            ],
        }
    }
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
    pub reductions: HashMap<crate::Index, ReductionMem>,
    pub swaps: [usize; 3],
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

#[derive(Debug, Default)]
pub struct MarsMem {
    pub complex: Option<ComplexMem>,
    pub grid: Option<GridMem>,
}

impl Into<MarsMem> for &Mars {
    fn into(self) -> MarsMem {
        MarsMem {
            complex: self.complex.as_ref().map(|c| c.into()),
            grid: self.grid.as_ref().map(|c| c.into()),
        }
    }
}

#[derive(Debug, Default)]
pub struct ComplexMem {
    simplices_per_dim: Vec<usize>,
}

impl Into<ComplexMem> for &complex::Complex {
    fn into(self) -> ComplexMem {
        ComplexMem {
            simplices_per_dim: self
                .simplices_per_dim
                .iter()
                .map(|v| {
                    v.iter()
                        .map(|s| {
                            size_of::<complex::Simplex>() + s.boundary.capacity() * size_of::<CI>()
                        })
                        .sum()
                })
                .collect(),
        }
    }
}

#[derive(Debug, Default)]
pub struct GridMem {
    points: usize,
    neighbors: usize,
}

impl Into<GridMem> for &Grid {
    fn into(self) -> GridMem {
        match self {
            Grid::Regular(_) => GridMem::default(),
            Grid::Mesh(g) => GridMem {
                points: g.points.capacity() * size_of::<CI>(),
                neighbors: g
                    .neighbors
                    .iter()
                    .map(|n| n.capacity() * size_of::<CI>())
                    .sum(),
            },
        }
    }
}
