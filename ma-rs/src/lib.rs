use std::iter::zip;

use permutation::Permutation;
use pyo3::prelude::*;
use sneaky_matrix::{Col, SneakyMatrix};

pub mod complex;
pub mod permutation;
pub mod sneaky_matrix;

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
