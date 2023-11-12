use std::iter::zip;

use complex::{Complex, Pos, Simplex};
use permutation::Permutation;
use pyo3::{exceptions::PyValueError, prelude::*};
use sneaky_matrix::{Col, SneakyMatrix};

pub mod complex;
pub mod grid;
pub mod permutation;
pub mod sneaky_matrix;

#[pyo3::pyclass(get_all)]
#[derive(Clone, Debug)]
#[allow(non_snake_case)]
pub struct Stack {
    /// Boundary matrix
    pub D: SneakyMatrix,
    /// Reduced boundary matrix
    pub R: SneakyMatrix,
    /// Inverse of the "column adds" matrix.
    pub U_t: SneakyMatrix,
    /// Ordering of the simplices. Cannonical to sorted order.
    pub ordering: Permutation,
}

#[pyo3::pyclass(get_all)]
#[derive(Clone, Debug)]
pub struct Reduction {
    /// Key point around which the reduction is done.
    pub key_point: Pos,
    pub stacks: [Stack; 3],
}

#[allow(non_snake_case)]
impl Reduction {
    pub fn D(&self, dim: isize) -> &SneakyMatrix {
        assert!(0 <= dim);
        assert!(dim <= 2);
        &self.stacks[dim as usize].D
    }

    pub fn R(&self, dim: isize) -> &SneakyMatrix {
        assert!(0 <= dim);
        assert!(dim <= 2);
        &self.stacks[dim as usize].R
    }

    pub fn U_t(&self, dim: isize) -> &SneakyMatrix {
        assert!(0 <= dim);
        assert!(dim <= 2);
        &self.stacks[dim as usize].U_t
    }

    pub fn ordering(&self, dim: isize) -> &Permutation {
        assert!(0 <= dim);
        assert!(dim <= 2);
        &self.stacks[dim as usize].ordering
    }
}

pub fn inverse_zz2(mat: &SneakyMatrix) -> Result<SneakyMatrix, String> {
    let res: PyResult<SneakyMatrix> = Python::with_gil(|py| {
        // println!("set up module");
        let module = PyModule::from_code(
            py,
            r#"
import numpy as np
import mars
import galois
GF2 = galois.GF(2)

def invert(rs_mat):
    A = np.zeros((rs_mat.rows, rs_mat.cols), dtype=np.int8)
    for r in range(rs_mat.rows):
        for c in range(rs_mat.cols):
            if rs_mat.get(r, c):
                A[r, c] = 1
    gf = GF2(A)
    inv = np.linalg.inv(gf)
    U_t = np.array(inv).T

    (rr, cc) = U_t.shape
    ret = mars.SneakyMatrix.zeros(rr, cc)
    for r in range(rr):
        for c in range(cc):
            if U_t[r, c] == 1:
                ret.set(r, c, True)
    return ret
"#,
            "pretend.py",
            "pretend",
        )?;

        // println!("set up module done");

        let invert = module.getattr("invert")?;

        // println!("call invert");
        let res = invert
            .call((mat.clone(),), None)?
            .extract::<SneakyMatrix>()?;
        // println!("call invert done");

        Ok(res)
    });

    res.map_err(|e| e.to_string())
}

/// The permutations returned are such that when you go forwards through the
/// permutation, you get the simplices in sorted order based on their distance
/// to the key point.
///
/// I.e, `v_perm[0]` is the canonical index of the closest vertex, and
/// `v_perm[0]` is the canonical index of the second closest index.
///
/// In other words, `v_perm.map` takes a "sorted" index and returns a "canonical" index.
fn compute_permutations(
    complex: &Complex,
    key_point: Pos,
) -> (Permutation, Permutation, Permutation) {
    let vertex_distances = complex.simplices_per_dim[0]
        .iter()
        .map(|v| float_ord::FloatOrd(v.coords.unwrap().dist(&key_point)))
        .collect::<Vec<_>>();

    let edge_distances = complex.simplices_per_dim[1]
        .iter()
        .map(|e| {
            vertex_distances[e.boundary[0] as usize].max(vertex_distances[e.boundary[1] as usize])
        })
        .collect::<Vec<_>>();

    let triangle_distances = complex.simplices_per_dim[2]
        .iter()
        .map(|f| {
            edge_distances[f.boundary[0] as usize]
                .max(edge_distances[f.boundary[1] as usize])
                .max(edge_distances[f.boundary[2] as usize])
        })
        .collect::<Vec<_>>();

    let v_perm = Permutation::from_ord(&vertex_distances);
    let e_perm = Permutation::from_ord(&edge_distances);
    let t_perm = Permutation::from_ord(&triangle_distances);

    (v_perm, e_perm, t_perm)
}

#[pyfunction]
/// Returns a [Vec] with one element per faustian swap. The elements are `(dim,
/// (i, j))` where `dim` is the dimension of the simplices that were swapped,
/// and `i` and `j` are the canonical indices of the swapped simplices.
pub fn vineyards_123(
    complex: &Complex,
    reduction: &Reduction,
    key_point: Pos,
) -> Vec<(i32, (usize, usize))> {
    let (mut v_perm, mut e_perm, mut t_perm) = compute_permutations(complex, key_point);

    let mut stack0 = reduction.stacks[0].clone();
    let mut stack1 = reduction.stacks[1].clone();
    let mut stack2 = reduction.stacks[2].clone();

    let mut faustian_swap_simplices = Vec::new();

    // NOTE: we need the permutation from cannonical to sorted, so that we can
    // get the permutation that takes us from the `b` point to the `a` point, so
    // that, in turn, we can bubble sort from `a` to `b`.
    v_perm.reverse();
    let vine_ordering0 = Permutation::from_to(&v_perm, &stack0.ordering);
    let (swap_is0, simplices_that_got_swapped0) =
        compute_transpositions(vine_ordering0.into_forwards());
    for &i in &swap_is0 {
        let res = perform_one_swap2(i, &mut stack0, &mut stack1);
        stack0.D.swap_cols(i, i + 1);
        stack1.D.swap_rows(i, i + 1);
        if let Some(true) = res {
            // These are indices of simplices that we said were the 0,1,2... order
            // in the bubble sort (compute_transpositions).  This is the order
            // of the simplices at `b`.
            let (i, j) = simplices_that_got_swapped0[i];
            let cann_i = v_perm.inv(i);
            let cann_j = v_perm.inv(j);

            faustian_swap_simplices.push((0, (cann_i, cann_j)));
        }
    }

    e_perm.reverse();
    let vine_ordering1 = Permutation::from_to(&e_perm, &stack1.ordering);
    let (swap_is1, simplices_that_got_swapped1) =
        compute_transpositions(vine_ordering1.into_forwards());
    for &i in &swap_is1 {
        let res = perform_one_swap2(i, &mut stack1, &mut stack2);
        stack1.D.swap_cols(i, i + 1);
        stack2.D.swap_rows(i, i + 1);
        if let Some(true) = res {
            let (i, j) = simplices_that_got_swapped1[i];
            let cann_i = e_perm.inv(i);
            let cann_j = e_perm.inv(j);

            faustian_swap_simplices.push((1, (cann_i, cann_j)));
        }
    }

    t_perm.reverse();
    let vine_ordering2 = Permutation::from_to(&t_perm, &stack2.ordering);
    let (swap_is2, simplices_that_got_swapped2) =
        compute_transpositions(vine_ordering2.into_forwards());
    for &i in &swap_is2 {
        let res = perform_one_swap_top_dim(i, &mut stack2);
        stack2.D.swap_cols(i, i + 1);
        if let Some(true) = res {
            let (i, j) = simplices_that_got_swapped2[i];
            let cann_i = t_perm.inv(i);
            let cann_j = t_perm.inv(j);

            faustian_swap_simplices.push((2, (cann_i, cann_j)));
        }
    }

    faustian_swap_simplices
}

#[allow(non_snake_case)]
#[pyfunction]
pub fn reduce_from_scratch(complex: &Complex, key_point: Pos) -> Reduction {
    let (mut v_perm, mut e_perm, mut t_perm) = compute_permutations(complex, key_point);

    let mut boundary_0 = complex.boundary_matrix(0);
    boundary_0.col_perm = v_perm.clone();
    let D0 = boundary_0.clone();

    let mut boundary_1 = complex.boundary_matrix(1);
    boundary_1.col_perm = e_perm.clone();
    boundary_1.row_perm = v_perm.clone();
    let D1 = boundary_1.clone();

    let mut boundary_2 = complex.boundary_matrix(2);
    boundary_2.col_perm = t_perm.clone();
    boundary_2.row_perm = e_perm.clone();
    let D2 = boundary_2.clone();

    let adds0 = boundary_0.reduce();
    let adds1 = boundary_1.reduce();
    let adds2 = boundary_2.reduce();

    let mut V0 = SneakyMatrix::eye(boundary_0.cols);
    for (target, other) in adds0 {
        V0.add_cols(target, other);
    }

    let mut V1 = SneakyMatrix::eye(boundary_1.cols);
    for (target, other) in adds1 {
        V1.add_cols(target, other);
    }

    let mut V2 = SneakyMatrix::eye(boundary_2.cols);
    for (target, other) in adds2 {
        V2.add_cols(target, other);
    }

    let U_t0 = inverse_zz2(&V0).expect("inverse_zz2 failed");
    let U_t1 = inverse_zz2(&V1).expect("inverse_zz2 failed");
    let U_t2 = inverse_zz2(&V2).expect("inverse_zz2 failed");

    let R0 = boundary_0;
    let R1 = boundary_1;
    let R2 = boundary_2;

    v_perm.reverse();
    e_perm.reverse();
    t_perm.reverse();

    Reduction {
        key_point,
        stacks: [
            Stack {
                D: D0,
                R: R0,
                U_t: U_t0,
                ordering: v_perm,
            },
            Stack {
                D: D1,
                R: R1,
                U_t: U_t1,
                ordering: e_perm,
            },
            Stack {
                D: D2,
                R: R2,
                U_t: U_t2,
                ordering: t_perm,
            },
        ],
    }
}

#[allow(non_snake_case)]
fn perform_one_swap2(i: usize, stack: &mut Stack, up_stack: &mut Stack) -> Option<bool> {
    #[allow(non_snake_case)]
    fn gives_death(R: &SneakyMatrix, c: usize) -> bool {
        R.col_is_not_empty(c)
    }

    #[allow(non_snake_case)]
    fn low(R: &SneakyMatrix, c: usize) -> Option<usize> {
        R.colmax(c)
    }

    #[allow(non_snake_case)]
    fn low_inv(R: &SneakyMatrix, r: usize) -> Option<usize> {
        R.col_with_low(r)
    }

    let gives_death_i = gives_death(&stack.R, i);
    let gives_birth_i = !gives_death_i;
    let gives_death_i_1 = gives_death(&stack.R, i + 1);
    let gives_birth_i_1 = !gives_death_i_1;

    // if gives_birth_i and gives_birth_i_1:
    if gives_birth_i && gives_birth_i_1 {
        // U_t[i + 1, i] = 0
        stack.U_t.set(i + 1, i, false);
        // k = low_inv(i)
        let k = low_inv(&up_stack.R, i);
        // l = low_inv(i + 1)
        let l = low_inv(&up_stack.R, i + 1);
        // if k != None and l != None and R[i, l] == 1:
        if let (Some(k), Some(l)) = (k, l) {
            if up_stack.R.get(i, l) {
                // if k < l:
                if k < l {
                    // R.swap_cols_and_rows(i, i + 1)  # PRP
                    stack.R.swap_cols(i, i + 1);
                    up_stack.R.swap_rows(i, i + 1);
                    // R.add_cols(l, k)  # PRPV
                    up_stack.R.add_cols(l, k);
                    // U_t.swap_cols_and_rows(i, i + 1)  # PUP
                    stack.U_t.swap_cols_and_rows(i, i + 1);
                    // U_t.add_cols(k, l)  # VPUP
                    up_stack.U_t.add_cols(k, l);
                    // return (R, U_t, None)
                    return None;
                }
                // if l < k:
                if l < k {
                    // R.swap_cols_and_rows(i, i + 1)  # PRP
                    stack.R.swap_cols(i, i + 1);
                    up_stack.R.swap_rows(i, i + 1);
                    // R.add_cols(k, l)  # PRPV
                    up_stack.R.add_cols(k, l);
                    // U_t.swap_cols_and_rows(i, i + 1)  # PUP
                    stack.U_t.swap_cols_and_rows(i, i + 1);
                    // U_t.add_cols(l, k)  # VPUP
                    up_stack.U_t.add_cols(l, k);
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
        stack.R.swap_cols(i, i + 1);
        up_stack.R.swap_rows(i, i + 1);
        // U_t.swap_cols_and_rows(i, i + 1)  # PUP
        stack.U_t.swap_cols_and_rows(i, i + 1);
        // return (R, U_t, None)
        return None;
    }
    // if gives_death_i and gives_death_i_1:
    if gives_death_i && gives_death_i_1 {
        // if U_t[i + 1, i] == 1:
        if stack.U_t.get(i + 1, i) {
            // low_i = low(i)
            let low_i = low(&stack.R, i);
            // low_i_1 = low(i + 1)
            let low_i_1 = low(&stack.R, i + 1);
            // U_t.add_cols(i, i + 1)  # W U
            stack.U_t.add_cols(i, i + 1);
            // R.add_cols(i + 1, i)  # R W
            stack.R.add_cols(i + 1, i);
            // R.swap_cols_and_rows(i, i + 1)  # P R W P
            stack.R.swap_cols(i, i + 1);
            up_stack.R.swap_rows(i, i + 1);
            // U_t.swap_cols_and_rows(i, i + 1)  # P W U P
            stack.U_t.swap_cols_and_rows(i, i + 1);
            // if low_i < low_i_1:
            if low_i < low_i_1 {
                // return (R, U_t, None)
                return None;
            // else:
            } else {
                // R.add_cols(i + 1, i)  # (P R W P) W
                stack.R.add_cols(i + 1, i);
                // U_t.add_cols(i, i + 1)  # W (P W U P)
                stack.U_t.add_cols(i, i + 1);
                // return (R, U_t, False)
                return Some(false);
            }
        // else:
        } else {
            // R.swap_cols_and_rows(i, i + 1)  # P R P
            stack.R.swap_cols(i, i + 1);
            up_stack.R.swap_rows(i, i + 1);
            // U_t.swap_cols_and_rows(i, i + 1)  # P U P
            stack.U_t.swap_cols_and_rows(i, i + 1);
            // return (R, U_t, None)
            return None;
        }
    }
    // if gives_death_i and gives_birth_i_1:
    if gives_death_i && gives_birth_i_1 {
        // if U_t[i + 1, i] == 1:
        if stack.U_t.get(i + 1, i) {
            // U_t.add_cols(i, i + 1)  # W U
            stack.U_t.add_cols(i, i + 1);
            // R.add_cols(i + 1, i)  # R W
            stack.R.add_cols(i + 1, i);
            // R.swap_cols_and_rows(i, i + 1)  # P R W P
            stack.R.swap_cols(i, i + 1);
            up_stack.R.swap_rows(i, i + 1);
            // R.add_cols(i + 1, i)  # (P R W P) W
            stack.R.add_cols(i + 1, i);
            // U_t.swap_cols_and_rows(i, i + 1)  # P W U P
            stack.U_t.swap_cols_and_rows(i, i + 1);
            // U_t.add_cols(i, i + 1)  # W (P W U P)
            stack.U_t.add_cols(i, i + 1);
            // return (R, U_t, True)
            return Some(true);
        // else:
        } else {
            // R.swap_cols_and_rows(i, i + 1)  # P R P
            stack.R.swap_cols(i, i + 1);
            up_stack.R.swap_rows(i, i + 1);
            // U_t.swap_cols_and_rows(i, i + 1)  # P U P
            stack.U_t.swap_cols_and_rows(i, i + 1);
            // return (R, U_t, None)
            return None;
        }
    }
    // if gives_birth_i and gives_death_i_1:
    if gives_birth_i && gives_death_i_1 {
        // U_t[i + 1, i] = 0
        stack.U_t.set(i + 1, i, false);
        // R.swap_cols_and_rows(i, i + 1)  # P R P
        stack.R.swap_cols(i, i + 1);
        up_stack.R.swap_rows(i, i + 1);
        // U_t.swap_cols_and_rows(i, i + 1)  # P U P
        stack.U_t.swap_cols_and_rows(i, i + 1);
        // return (R, U_t, None)
        return None;
    }

    // raise Exception("bottom of the function; This should never happen.")
    panic!("This should never happen: no cases matched.");
}

#[allow(non_snake_case)]
fn perform_one_swap_top_dim(i: usize, stack: &mut Stack) -> Option<bool> {
    #[allow(non_snake_case)]
    fn gives_death(R: &SneakyMatrix, c: usize) -> bool {
        R.col_is_not_empty(c)
    }

    #[allow(non_snake_case)]
    fn low(R: &SneakyMatrix, c: usize) -> Option<usize> {
        R.colmax(c)
    }

    let gives_death_i = gives_death(&stack.R, i);
    let gives_birth_i = !gives_death_i;
    let gives_death_i_1 = gives_death(&stack.R, i + 1);
    let gives_birth_i_1 = !gives_death_i_1;

    // if gives_birth_i and gives_birth_i_1:
    if gives_birth_i && gives_birth_i_1 {
        // U_t[i + 1, i] = 0
        stack.U_t.set(i + 1, i, false);
        // k = low_inv(i)

        // else case
        // R.swap_cols_and_rows(i, i + 1)  # PRP
        stack.R.swap_cols(i, i + 1);
        // U_t.swap_cols_and_rows(i, i + 1)  # PUP
        stack.U_t.swap_cols_and_rows(i, i + 1);
        // return (R, U_t, None)
        return None;
    }
    // if gives_death_i and gives_death_i_1:
    if gives_death_i && gives_death_i_1 {
        // if U_t[i + 1, i] == 1:
        if stack.U_t.get(i + 1, i) {
            // low_i = low(i)
            let low_i = low(&stack.R, i);
            // low_i_1 = low(i + 1)
            let low_i_1 = low(&stack.R, i + 1);
            // U_t.add_cols(i, i + 1)  # W U
            stack.U_t.add_cols(i, i + 1);
            // R.add_cols(i + 1, i)  # R W
            stack.R.add_cols(i + 1, i);
            // R.swap_cols_and_rows(i, i + 1)  # P R W P
            stack.R.swap_cols(i, i + 1);
            // U_t.swap_cols_and_rows(i, i + 1)  # P W U P
            stack.U_t.swap_cols_and_rows(i, i + 1);
            // if low_i < low_i_1:
            if low_i < low_i_1 {
                // return (R, U_t, None)
                return None;
            // else:
            } else {
                // R.add_cols(i + 1, i)  # (P R W P) W
                stack.R.add_cols(i + 1, i);
                // U_t.add_cols(i, i + 1)  # W (P W U P)
                stack.U_t.add_cols(i, i + 1);
                // return (R, U_t, False)
                return Some(false);
            }
        // else:
        } else {
            // R.swap_cols_and_rows(i, i + 1)  # P R P
            stack.R.swap_cols(i, i + 1);
            // U_t.swap_cols_and_rows(i, i + 1)  # P U P
            stack.U_t.swap_cols_and_rows(i, i + 1);
            // return (R, U_t, None)
            return None;
        }
    }
    // if gives_death_i and gives_birth_i_1:
    if gives_death_i && gives_birth_i_1 {
        // if U_t[i + 1, i] == 1:
        if stack.U_t.get(i + 1, i) {
            // U_t.add_cols(i, i + 1)  # W U
            stack.U_t.add_cols(i, i + 1);
            // R.add_cols(i + 1, i)  # R W
            stack.R.add_cols(i + 1, i);
            // R.swap_cols_and_rows(i, i + 1)  # P R W P
            stack.R.swap_cols(i, i + 1);
            // R.add_cols(i + 1, i)  # (P R W P) W
            stack.R.add_cols(i + 1, i);
            // U_t.swap_cols_and_rows(i, i + 1)  # P W U P
            stack.U_t.swap_cols_and_rows(i, i + 1);
            // U_t.add_cols(i, i + 1)  # W (P W U P)
            stack.U_t.add_cols(i, i + 1);
            // return (R, U_t, True)
            return Some(true);
        // else:
        } else {
            // R.swap_cols_and_rows(i, i + 1)  # P R P
            stack.R.swap_cols(i, i + 1);
            // U_t.swap_cols_and_rows(i, i + 1)  # P U P
            stack.U_t.swap_cols_and_rows(i, i + 1);
            // return (R, U_t, None)
            return None;
        }
    }
    // if gives_birth_i and gives_death_i_1:
    if gives_birth_i && gives_death_i_1 {
        // U_t[i + 1, i] = 0
        stack.U_t.set(i + 1, i, false);
        // R.swap_cols_and_rows(i, i + 1)  # P R P
        stack.R.swap_cols(i, i + 1);
        // U_t.swap_cols_and_rows(i, i + 1)  # P U P
        stack.U_t.swap_cols_and_rows(i, i + 1);
        // return (R, U_t, None)
        return None;
    }

    // raise Exception("bottom of the function; This should never happen.")
    panic!("This should never happen: no cases matched.");
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

/// Compute the transpositions required to swap a permutation to become `0..n`.
///
/// Returns a `Vec<usize>` where each element `i` correspond to the transposition
/// `(i, i+1)` taking place.
/// Also return the "column value" of the simplices that were swapped. This is
/// used to figure out which simplices the swap consisted of.
#[pyfunction]
pub fn compute_transpositions(mut b: Vec<usize>) -> (Vec<usize>, Vec<(usize, usize)>) {
    // NOTE: The `this` ordering is implicitly `0..n`.
    let n = b.len();
    let n0 = zip(&b, 0..n).position(|(&aa, bb)| aa != bb).unwrap_or(n);
    let n1 = zip(&b, 0..n).rposition(|(&aa, bb)| aa != bb).unwrap_or(n);
    let mut ret = Vec::with_capacity(n);
    let mut swapped_indices = Vec::with_capacity(n);
    for _ in n0..=n1 {
        let mut swap = false;
        for i in 0..(n - 1) {
            if b[i] > b[i + 1] {
                ret.push(i);
                b.swap(i, i + 1);
                swapped_indices.push((b[i], b[i + 1]));
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
/// Run both `compute_transpositions` and `vine_to_vine`.
pub fn reduce_vine(
    ordering: Vec<usize>,
    R: &mut SneakyMatrix,
    D: &mut SneakyMatrix,
    U_t: &mut SneakyMatrix,
) -> (Vec<(usize, usize)>, usize) {
    let (swapped_indices, swapped_simplices) = compute_transpositions(ordering);
    let num_swaps = swapped_indices.len();
    let faustians = vine_to_vine(D, R, U_t, swapped_indices);
    (
        faustians
            .into_iter()
            .map(|i| swapped_simplices[i])
            .collect::<Vec<_>>(),
        num_swaps,
    )
}

#[pyfunction]
pub fn read_from_obj(p: &str) -> PyResult<Complex> {
    Complex::read_from_obj(p).map_err(PyValueError::new_err)
}

#[pymodule]
fn mars(_py: Python, m: &PyModule) -> PyResult<()> {
    m.add_function(wrap_pyfunction!(vine_to_vine, m)?)?;
    m.add_function(wrap_pyfunction!(compute_transpositions, m)?)?;
    m.add_function(wrap_pyfunction!(reduce_vine, m)?)?;
    m.add_function(wrap_pyfunction!(read_from_obj, m)?)?;
    m.add_function(wrap_pyfunction!(reduce_from_scratch, m)?)?;
    m.add_function(wrap_pyfunction!(vineyards_123, m)?)?;
    m.add_class::<SneakyMatrix>()?;
    m.add_class::<Permutation>()?;
    m.add_class::<Col>()?;
    m.add_class::<Simplex>()?;
    m.add_class::<Complex>()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

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
