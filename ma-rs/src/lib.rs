use std::{
    collections::{HashMap, HashSet},
    iter::zip,
};

use complex::{Complex, Pos, Simplex};
use grid::Grid;
use permutation::Permutation;
use sneaky_matrix::{Col, SneakyMatrix};

#[cfg(feature = "python")]
use pyo3::{exceptions::PyValueError, prelude::*};

#[cfg(feature = "wasm")]
use wasm_bindgen::prelude::*;
#[cfg(feature = "wasm")]
mod wasm;
#[cfg(feature = "wasm")]
pub use wasm::*;

use crate::json::json_output;

pub mod complex;
pub mod grid;
pub mod json;
pub mod permutation;
pub mod sneaky_matrix;

#[cfg_attr(feature = "wasm", wasm_bindgen)]
pub fn hello_from_rust() -> String {
    "Hello from Rust!".to_string()
}

#[cfg_attr(feature = "python", pyo3::pyclass(get_all))]
#[derive(Clone, Debug, serde::Serialize)]
pub struct Swap {
    /// Dimension in which the swap happened.
    dim: usize,
    /// Canonical index of the first simplex.
    i: usize,
    /// Canonical index of the second simplex.
    j: usize,
}

#[cfg_attr(feature = "python", pyo3::pyclass(get_all))]
#[derive(Clone, Debug, serde::Serialize)]
pub struct Swaps {
    pub v: Vec<Swap>,
}

#[cfg_attr(feature = "python", pymethods)]
impl Swaps {
    #[cfg_attr(feature = "python", new)]
    pub fn new(v: Vec<Swap>) -> Self {
        Self { v }
    }

    /// Remove all swaps that were done between simplices that are closer than
    /// `min_dist`.
    ///
    /// Useful for 0th MA.
    pub fn prune_euclidian(&mut self, complex: &Complex, min_dist: f64) {
        self.v.retain(|swap| {
            let c1 = complex.simplices_per_dim[swap.dim][swap.i].center_point(complex);
            let c2 = complex.simplices_per_dim[swap.dim][swap.j].center_point(complex);
            let dist = c1.dist2(&c2);
            min_dist < dist
        })
    }

    pub fn prune_common_face(&mut self, complex: &Complex) {
        let mut simp_to_vertices: HashMap<(usize, usize), HashSet<usize>> = HashMap::new();

        for dim in 1..3 {
            for (i, s) in complex.simplices_per_dim[dim].iter().enumerate() {
                if dim == 1 {
                    let set = simp_to_vertices
                        .entry((dim, i))
                        .or_insert_with(|| HashSet::new());
                    for b in &s.boundary {
                        set.insert(*b);
                    }
                } else {
                    for b in &s.boundary {
                        let face_set = simp_to_vertices
                            .get(&(dim - 1, *b))
                            .expect("Should have inserted this simplex before")
                            .clone();
                        let set = simp_to_vertices
                            .entry((dim, i))
                            .or_insert_with(|| HashSet::new());
                        set.extend(face_set);
                    }
                }
            }
        }

        self.v.retain(|swap| {
            if swap.dim == 0 {
                return true;
            }
            let set_i = simp_to_vertices.get(&(swap.dim, swap.i)).unwrap();
            let set_j = simp_to_vertices.get(&(swap.dim, swap.j)).unwrap();
            let mut intersection = set_i.intersection(set_j);
            intersection.next() == None
        });
    }

    /// Remove all swaps that happen between simplices if there is a simplex
    /// with the two simplices in its boundary.
    pub fn prune_coboundary(&mut self, complex: &Complex) {
        // (dim, id) to [id].
        let mut coboundary: HashMap<(usize, usize), HashSet<usize>> = HashMap::new();

        for dim in 1..3 {
            for (parent_i, s) in complex.simplices_per_dim[dim].iter().enumerate() {
                for face_i in &s.boundary {
                    let v = coboundary
                        .entry((dim - 1, *face_i))
                        .or_insert_with(HashSet::new);
                    v.insert(parent_i);
                }
            }
        }

        self.v.retain(|swap| {
            if swap.dim == 2 {
                return true;
            }

            let cob_i = coboundary.get(&(swap.dim, swap.i));
            let cob_j = coboundary.get(&(swap.dim, swap.j));

            if let (Some(cob_i), Some(cob_j)) = (cob_i, cob_j) {
                let mut intersection = cob_i.intersection(cob_j);
                intersection.next() == None
            } else {
                true
            }
        });
    }

    /// Remove all swaps that happened where the persistence of any of the
    /// simplices were less than `lifetime`.
    ///
    /// `lifetime` can for instance be `0.01`.
    ///
    /// Probably only useful for 1st MA.
    pub fn prune_persistence(
        &mut self,
        complex: &Complex,
        reduction_from: &Reduction,
        reduction_to: &Reduction,
        lifetime: f64,
    ) {
        let (vd, ed, td) = complex.distances_to(reduction_from.key_point);
        let distances_from = [vd, ed, td];
        let (vd, ed, td) = complex.distances_to(reduction_to.key_point);
        let distances_to = [vd, ed, td];

        fn find_killer(dim: usize, can_id: usize, reduction: &Reduction) -> Option<usize> {
            if reduction.stacks.len() <= dim + 1 {
                return None;
            }
            let ordering = &reduction.stacks[dim].ordering;
            let sorted_i = ordering.map(can_id);
            let killer = reduction.stacks[dim + 1].R.col_with_low(sorted_i);
            if let Some(k) = killer {
                let can_k = reduction.stacks[dim + 1].ordering.inv(k);
                Some(can_k)
            } else {
                None
            }
        }

        fn persistence(
            dim: usize,
            can_id: usize,
            reduction: &Reduction,
            distances: &[Vec<f64>],
        ) -> Option<f64> {
            let killer = find_killer(dim, can_id, reduction);
            if let Some(killer) = killer {
                let dist = distances[dim][can_id];
                let killer_dist = distances[dim + 1][killer];
                let persistence = killer_dist - dist;
                Some(persistence)
            } else {
                None
            }
        }

        self.v.retain(|swap| {
            let persistence_i = persistence(swap.dim, swap.i, reduction_from, &distances_from);
            let persistence_j = persistence(swap.dim, swap.j, reduction_to, &distances_to);
            match (persistence_i, persistence_j) {
                (Some(p), Some(q)) => {
                    if p < lifetime && q < lifetime {
                        false
                    } else {
                        true
                    }
                }
                _ => true,
            }
        });
    }

    pub fn pyclone(&self) -> Self {
        self.clone()
    }
}

#[cfg_attr(feature = "python", pyo3::pyclass(get_all))]
#[derive(Clone, Debug)]
#[allow(non_snake_case)]
pub struct Stack {
    /// Boundary matrix. Size is (#vert, #edges)  (for 1st stack).
    pub D: SneakyMatrix,
    /// Reduced boundary matrix. Size is (#vert, #edges) (for 1st stack)
    pub R: SneakyMatrix,
    /// Inverse of the "column adds" matrix. Size is (#edges, #edges) (for 1st stack)
    pub U_t: SneakyMatrix,
    /// Ordering of the simplices. Cannonical to sorted order.
    pub ordering: Permutation,
}

#[cfg_attr(feature = "python", pyo3::pyclass(get_all))]
#[derive(Clone, Debug, serde::Serialize)]
pub struct BirthDeathPair {
    /// Dimension of the homology class.
    pub dim: isize,
    /// Birth time and canonical index of the simplex giving birth to the homology class.
    pub birth: Option<(f64, usize)>,
    /// Birth time and canonical index of the simplex giving birth to the homology class.
    pub death: Option<(f64, usize)>,
}

#[cfg_attr(feature = "python", pyo3::pyclass(get_all))]
#[derive(Clone, Debug)]
pub struct Reduction {
    /// Key point around which the reduction is done.
    pub key_point: Pos,
    pub stacks: [Stack; 3],
}

#[cfg_attr(feature = "python", pymethods)]
impl Reduction {
    /// Returns the Betti numbers for dimensions 0, 1, and 2.
    pub fn betti_numbers(&self) -> Vec<i8> {
        let mut bettis = vec![0; 3];
        for dim in 0..3 {
            let stack = &self.stacks[dim];
            for c in 0..stack.R.cols {
                if stack.R.col_is_empty(c) {
                    bettis[dim] += 1;
                } else if 0 < dim {
                    bettis[dim - 1] -= 1;
                }
            }
        }
        bettis
    }

    /// Compute the entering value of the given simplex.
    ///
    /// Uses squared Euclidian distance.
    ///
    /// The `id` is a canonical index.
    pub fn simplex_entering_value(&self, complex: &Complex, dim: usize, id: usize) -> f64 {
        let simplex = &complex.simplices_per_dim[dim][id];
        if dim == 0 {
            return simplex.coords.unwrap().dist2(&self.key_point);
        }
        simplex
            .boundary
            .iter()
            .map(|&b| self.simplex_entering_value(complex, dim - 1, b))
            .max_by(|a, b| a.partial_cmp(b).unwrap())
            .unwrap()
    }

    /// Find the killer of the given "simplex", if any.
    /// The `id` is a canonical index.
    fn find_killer(&self, dim: usize, id: usize) -> Option<usize> {
        if self.stacks.len() <= dim + 1 {
            return None;
        }
        let ordering = &self.stacks[dim].ordering;
        let sorted_i = ordering.map(id);
        let killer = self.stacks[dim + 1].R.col_with_low(sorted_i);
        if let Some(k) = killer {
            let can_k = self.stacks[dim + 1].ordering.inv(k);
            Some(can_k)
        } else {
            None
        }
    }

    /// Find the "simplex" that is killed by the given simplex, if any.
    ///
    /// `id` is a canonical index.
    fn find_victim(&self, dim: usize, id: usize) -> Option<usize> {
        if dim == 0 {
            // Pretend that the empty set doesn't exist, since we don't represent it explicitly.
            return None;
        }
        let sorted_id = self.stacks[dim].ordering.map(id);
        self.stacks[dim]
            .R
            .colmax(sorted_id)
            .map(|sorted_r| self.stacks[dim - 1].ordering.inv(sorted_r))
    }

    /// Compute the persistence of the given "simplex".
    /// `id` is the canonical index.
    ///
    /// Returns [None] if the "simplex" is not killed.
    pub fn persistence(&self, complex: &Complex, dim: usize, id: usize) -> Option<BirthDeathPair> {
        let killer = self.find_killer(dim, id);
        if let Some(killer) = killer {
            let dist = self.simplex_entering_value(complex, dim, id);
            let killer_dist = self.simplex_entering_value(complex, dim + 1, killer);
            Some(BirthDeathPair {
                dim: dim as isize,
                birth: Some((dist, id)),
                death: Some((killer_dist, killer)),
            })
        } else {
            // If we're the top dimension we will never be killed, but we might
            // have births. Check if column is zero.
            let ord_i = self.stacks[dim].ordering.map(id);
            if self.stacks[dim].R.col_is_empty(ord_i) {
                let dist = self.simplex_entering_value(complex, dim, id);
                Some(BirthDeathPair {
                    dim: dim as isize,
                    birth: Some((dist, id)),
                    death: None,
                })
            } else {
                None
            }
        }
    }

    pub fn barcode(&self, complex: &Complex, dim: isize) -> Vec<BirthDeathPair> {
        let mut ret = Vec::new();

        if dim == -1 {
            if 0 < complex.simplices_per_dim[0].len() {
                let first = self.stacks[0].ordering.inv(0);
                ret.push(BirthDeathPair {
                    dim: -1,
                    birth: None,
                    death: Some((self.simplex_entering_value(complex, 0, first), first)),
                });
            }
            return ret;
        }

        let ordering = &self.stacks[dim as usize].ordering;
        #[allow(non_snake_case)]
        let R = &self.stacks[dim as usize].R;

        for simplex in &complex.simplices_per_dim[dim as usize] {
            if !R.gives_birth(ordering.map(simplex.id)) {
                continue;
            }
            if let Some(persistence) = self.persistence(complex, dim as usize, simplex.id) {
                ret.push(persistence);
            }
        }
        ret
    }
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

    /// Checks that the ordering is consistent.
    pub fn assert_ordering(&self, complex: &Complex) {
        let mut vertex_distance = HashMap::new();

        let mut vertex_order = (0..complex.simplices_per_dim[0].len())
            .map(|i| {
                let s = &complex.simplices_per_dim[0][i];
                let coords = s.coords.unwrap();
                let dist = coords.dist2(&self.key_point);
                vertex_distance.insert(i, dist);
                let sorted_order = self.stacks[0].ordering.map(i);
                (float_ord::FloatOrd(dist), sorted_order)
            })
            .collect::<Vec<_>>();
        vertex_order.sort();

        for t in vertex_order.windows(2) {
            let a = t[0];
            let b = t[1];
            assert!(a.1 <= b.1, "a[1] = {:?}, b[1] = {:?}", a.1, b.1);
        }

        let mut edge_dist = HashMap::new();
        let mut edge_order = (0..complex.simplices_per_dim[1].len())
            .map(|i| {
                let s = &complex.simplices_per_dim[1][i];
                let ai = s.boundary[0] as usize;
                let bi = s.boundary[1] as usize;

                let adist = *vertex_distance.get(&ai).unwrap();
                let bdist = *vertex_distance.get(&bi).unwrap();

                let dist = adist.max(bdist);
                edge_dist.insert(i, dist);

                let sorted_order = self.stacks[1].ordering.map(i);
                (float_ord::FloatOrd(dist), sorted_order)
            })
            .collect::<Vec<_>>();
        edge_order.sort();

        for t in edge_order.windows(2) {
            let a = t[0];
            let b = t[1];
            assert!(a.1 <= b.1, "a.1 = {:?}, b.1 = {:?}", a, b);
        }

        let mut tri_order = (0..complex.simplices_per_dim[2].len())
            .map(|i| {
                let s = &complex.simplices_per_dim[2][i];

                let ai = s.boundary[0] as usize;
                let bi = s.boundary[1] as usize;
                let ci = s.boundary[1] as usize;

                let adist = *edge_dist.get(&ai).unwrap();
                let bdist = *edge_dist.get(&bi).unwrap();
                let cdist = *edge_dist.get(&ci).unwrap();

                let dist = adist.max(bdist).max(cdist);

                let sorted_order = self.stacks[2].ordering.map(i);
                (float_ord::FloatOrd(dist), sorted_order)
            })
            .collect::<Vec<_>>();
        tri_order.sort();

        for t in tri_order.windows(2) {
            let a = t[0];
            let b = t[1];
            assert!(a.0 <= b.0, "a[0] = {:?}, b[0] = {:?}", a.0, b.0); // This will always pass
            assert!(a.1 <= b.1, "a[1] = {:?}, b[1] = {:?}", a.1, b.1);
        }
    }
}

#[cfg(feature = "python")]
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
        .map(|v| float_ord::FloatOrd(v.coords.unwrap().dist2(&key_point)))
        .collect::<Vec<_>>();

    let edge_distances = complex.simplices_per_dim[1]
        .iter()
        .map(|e| {
            let dist_a = vertex_distances[e.boundary[0]];
            let dist_b = vertex_distances[e.boundary[1]];
            dist_a.max(dist_b)
        })
        .collect::<Vec<_>>();

    let triangle_distances = complex.simplices_per_dim[2]
        .iter()
        .map(|f| {
            let dist_a = edge_distances[f.boundary[0]];
            let dist_b = edge_distances[f.boundary[1]];
            let dist_c = edge_distances[f.boundary[2]];
            dist_a.max(dist_b).max(dist_c)
        })
        .collect::<Vec<_>>();

    let v_perm = Permutation::from_ord(&vertex_distances);
    let e_perm = Permutation::from_ord(&edge_distances);
    let t_perm = Permutation::from_ord(&triangle_distances);

    (v_perm, e_perm, t_perm)
}

#[cfg_attr(feature = "python", pyfunction)]
/// Returns a [Vec] with one element per faustian swap. The elements are `(dim,
/// (i, j))` where `dim` is the dimension of the simplices that were swapped,
/// and `i` and `j` are the canonical indices of the swapped simplices.
pub fn vineyards_123(
    complex: &Complex,
    reduction: &Reduction,
    key_point: Pos,
) -> (Reduction, Swaps) {
    let (mut v_perm, mut e_perm, mut t_perm) = compute_permutations(complex, key_point);

    let mut stack0 = reduction.stacks[0].clone();
    let mut stack1 = reduction.stacks[1].clone();
    let mut stack2 = reduction.stacks[2].clone();

    let mut faustian_swap_simplices = Vec::new();

    if 0 < t_perm.len() {
        t_perm.reverse();
        let vine_ordering2 = Permutation::from_to(&stack2.ordering, &t_perm);
        let (swap_is2, simplices_that_got_swapped2) =
            compute_transpositions(vine_ordering2.clone().into_forwards());
        for (swap_i, &i) in swap_is2.iter().enumerate() {
            let res = perform_one_swap_top_dim(i, &mut stack2);
            stack2.D.swap_cols(i, i + 1);
            if let Some(true) = res {
                let (i, j) = simplices_that_got_swapped2[swap_i];
                let cann_i = t_perm.inv(i);
                let cann_j = t_perm.inv(j);

                faustian_swap_simplices.push(Swap {
                    dim: 2,
                    i: cann_i,
                    j: cann_j,
                });
            }
        }
        stack2.ordering = t_perm;
    }

    if 0 < e_perm.len() {
        static EDGE_DEBUG: bool = false;

        let mut seen_swaps = HashSet::new();

        e_perm.reverse();
        let vine_ordering1 = Permutation::from_to(&stack1.ordering, &e_perm);
        let (swap_is1, simplices_that_got_swapped1) =
            compute_transpositions(vine_ordering1.clone().into_forwards());
        for (swap_i, &i) in swap_is1.iter().enumerate() {
            let res = perform_one_swap(
                i,
                &mut stack1,
                &mut stack2,
                &reduction.stacks[1],
                &reduction.stacks[2],
                complex,
                1,
                key_point,
            );
            stack1.D.swap_cols(i, i + 1);
            stack2.D.swap_rows(i, i + 1);
            if EDGE_DEBUG {
                let (i, j) = simplices_that_got_swapped1[swap_i];
                let cann_i = stack1.ordering.inv(i);
                let cann_j = stack1.ordering.inv(j);
                seen_swaps.insert((cann_i.min(cann_j), cann_i.max(cann_j)));
            }
            if let Some(true) = res {
                let (i, j) = simplices_that_got_swapped1[swap_i];
                let cann_i = e_perm.inv(i);
                let cann_j = e_perm.inv(j);

                faustian_swap_simplices.push(Swap {
                    dim: 1,
                    i: cann_i,
                    j: cann_j,
                });
            }
        }

        if EDGE_DEBUG {
            // Check that all pairs we've seen swapped actually has their ordering changed
            // wrt. the two key points.  In addition, check that the ones we have NOT seen
            // has their ordering the same.
            let a = reduction.key_point;
            let b = key_point;
            let (vd, ed, td) = complex.distances_to(a);
            let distances_a = [vd, ed, td];
            let (vd, ed, td) = complex.distances_to(b);
            let distances_b = [vd, ed, td];

            for i in 0..complex.simplices_per_dim[1].len() {
                for j in 0..i {
                    let dist_a_i = distances_a[1][i];
                    let dist_a_j = distances_a[1][j];
                    let cmp_at_a = dist_a_i.total_cmp(&dist_a_j);

                    let dist_b_i = distances_b[1][i];
                    let dist_b_j = distances_b[1][j];
                    let cmp_at_b = dist_b_i.total_cmp(&dist_b_j);

                    if cmp_at_a.is_eq() || cmp_at_b.is_eq() {
                        continue;
                    }

                    if seen_swaps.contains(&(j, i)) {
                        assert!(
                            cmp_at_a != cmp_at_b,
                            "Swapped, so ordering should have too: {:?} {:?}",
                            cmp_at_a,
                            cmp_at_b
                        );
                    } else {
                        assert!(
                            cmp_at_a == cmp_at_b,
                            "Ordering should be the same since they didn't swap: {:?} {:?}",
                            cmp_at_a,
                            cmp_at_b
                        );
                    }
                }
            }
        }
        stack1.ordering = e_perm;
    }

    // NOTE: we need the permutation from cannonical to sorted, so that we can
    // get the permutation that takes us from the `b` point to the `a` point, so
    // that, in turn, we can bubble sort from `a` to `b`.
    v_perm.reverse();

    // v_perm[0] = 12          this is the column at which v0 is at in the ordering.
    // stack0.ordering[0] = 14 this is the column at which v0 is at in the stack0 ordering.
    // if vine_ordering0[12] == 14, then
    // vine_ordering0[v_perm[0]] == stack0.ordering[0]  means that
    // v0 is column 12 at this ordering, and column 14 at the old ordering.
    // Which means that vine_ordering0 takes a new column index and produces an old column index.

    // This should map old to new indices.
    let vine_ordering0 = Permutation::from_to(&stack0.ordering, &v_perm);

    //  0 . 1 . 2 . 3 . 4 ...   <--- old indices
    // [0,  3,  1,  4,  2, ...] <------- new indices

    // First swap:
    //      1,  3
    // This was at index i=1, and corresponds to simplices at (3) and (1).

    // swap_is0 has to contain ordered indices from the OLD ordering.
    let (swap_is0, simplices_that_got_swapped0) =
        compute_transpositions(vine_ordering0.clone().into_forwards());

    for (swap_i, &i) in swap_is0.iter().enumerate() {
        let res = perform_one_swap(
            i,
            &mut stack0,
            &mut stack1,
            &reduction.stacks[0],
            &reduction.stacks[1],
            complex,
            0,
            key_point,
        );
        stack0.D.swap_cols(i, i + 1);
        stack1.D.swap_rows(i, i + 1);

        // {
        //     let (i, j) = simplices_that_got_swapped0[swap_i];
        //     let cann_i = stack0.ordering.inv(i);
        //     let cann_j = stack0.ordering.inv(j);
        //     seen_swaps.insert((cann_i.min(cann_j), cann_i.max(cann_j)));
        // }

        if let Some(true) = res {
            // These are indices of simplices that we said were the 0,1,2... order
            // in the bubble sort (compute_transpositions).  This is the order
            // of the simplices at `a`.
            let (i, j) = simplices_that_got_swapped0[swap_i];
            let cann_i = v_perm.inv(i);
            let cann_j = v_perm.inv(j);

            faustian_swap_simplices.push(Swap {
                dim: 0,
                i: cann_i,
                j: cann_j,
            });
        }
    }

    // Check that all pairs we've seen swapped actually has their ordering changed
    // wrt. the two key points.  In addition, check that the ones we have NOT seen
    // has their ordering the same.
    // for i in 0..complex.simplices_per_dim[0].len() {
    //     for j in 0..i {
    //         let p_i = complex.simplices_per_dim[0][i].coords.unwrap();
    //         let p_j = complex.simplices_per_dim[0][j].coords.unwrap();

    //         let a = reduction.key_point;
    //         let b = key_point;

    //         let cmp_at_a = a.dist(&p_i).total_cmp(&a.dist(&p_j));
    //         let cmp_at_b = b.dist(&p_i).total_cmp(&b.dist(&p_j));

    //         if seen_swaps.contains(&(j, i)) {
    //             assert!(
    //                 (cmp_at_a.is_eq() && cmp_at_b.is_eq()) || (cmp_at_a != cmp_at_b),
    //                 "Swapped, so ordering should have too: {:?} {:?}",
    //                 cmp_at_a,
    //                 cmp_at_b
    //             );
    //         } else {
    //             assert!(
    //                 cmp_at_a.is_eq() || cmp_at_b.is_eq() || cmp_at_a == cmp_at_b,
    //                 "Ordering should be the same since they didn't swap: {:?} {:?}",
    //                 cmp_at_a,
    //                 cmp_at_b
    //             );
    //         }
    //     }
    // }

    stack0.ordering = v_perm;

    // println!("vineyards_123");
    // dbg!(&vine_ordering0);
    // dbg!(&vine_ordering1);
    // dbg!(&vine_ordering2);

    let state = Reduction {
        key_point,
        stacks: [stack0, stack1, stack2],
    };

    (
        state,
        Swaps {
            v: faustian_swap_simplices,
        },
    )
}

#[allow(non_snake_case)]
#[cfg_attr(feature = "python", pyfunction)]
pub fn reduce_from_scratch(complex: &Complex, key_point: Pos, noisy: bool) -> Reduction {
    let (mut v_perm, mut e_perm, mut t_perm) = compute_permutations(complex, key_point);
    // dbg!(&key_point);
    // println!(
    //     "Position of the closest vertex is {:?} (dist={})",
    //     complex.simplices_per_dim[0][v_perm.map(0)].coords.unwrap(),
    //     complex.simplices_per_dim[0][v_perm.map(0)]
    //         .coords
    //         .unwrap()
    //         .dist(&key_point)
    // );
    // println!(
    //     "INV Position of the closest vertex is {:?} dist({})",
    //     complex.simplices_per_dim[0][v_perm.inv(0)].coords.unwrap(),
    //     complex.simplices_per_dim[0][v_perm.inv(0)]
    //         .coords
    //         .unwrap()
    //         .dist(&key_point)
    // );

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

    if noisy {
        print!("Reduce dim0 ... ");
    }
    let adds0 = boundary_0.reduce();
    if noisy {
        print!("done\nReduce dim1 ... ");
    }
    let adds1 = boundary_1.reduce();
    if noisy {
        print!("done\nReduce dim2 ... ");
    }
    let adds2 = boundary_2.reduce();
    if noisy {
        println!("done");
    }

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

    if noisy {
        print!("Invert V0 ... ");
    }
    let U_t0 = V0.inverse_gauss_jordan();
    if noisy {
        print!("done\nInvert V1 ... ");
    }
    let U_t1 = V1.inverse_gauss_jordan();
    if noisy {
        print!("done\nInvert V2 ... ");
    }
    let U_t2 = V2.inverse_gauss_jordan();
    if noisy {
        println!("done");
    }

    let R0 = boundary_0;
    let R1 = boundary_1;
    let R2 = boundary_2;

    v_perm.reverse();
    e_perm.reverse();
    t_perm.reverse();

    let ret = Reduction {
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
    };

    ret.assert_ordering(&complex);

    // println!(
    //     "reduce_from_scratch: stack0.ordering: {:?}",
    //     ret.stacks[0].ordering.clone().into_forwards()
    // );

    ret
}

#[allow(non_snake_case)]
fn perform_one_swap(
    i: usize,
    stack: &mut Stack,
    up_stack: &mut Stack,
    old_stack: &Stack,
    old_stack_above: &Stack,
    complex: &Complex,
    dim: usize,
    key_point: Pos,
) -> Option<bool> {
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

            // NOTE: We also need to check that the swapped simplices
            // corresponpds to the first birth in this dim.

            // let EPS = 0.01;
            // let our_old_persistence = {
            //     // NOTE: the stored order of these matrices is actually ALSO the canonical ordering.
            //     let can_index = stack.D.col_perm.map(i + 1);
            //     let old_stack_index = old_stack.ordering.map(can_index);
            //     if let Some(old_stack_tri) = old_stack_above.R.col_with_low(old_stack_index) {
            //         let can_tri = old_stack_above.ordering.inv(old_stack_tri);
            //         let killed_at = complex.simplex_entering_value(dim + 1, can_tri, key_point);
            //         let born_at = complex.simplex_entering_value(dim, can_index, key_point);
            //         Some(killed_at - born_at)
            //     } else {
            //         None
            //     }
            // };

            // let our_new_persistence = {
            //     let can_index = stack.D.col_perm.map(i);
            //     if let Some(up_stack_tri) = up_stack.R.col_with_low(i) {
            //         let can_tri = up_stack.D.row_perm.map(up_stack_tri);
            //         let killed_at = complex.simplex_entering_value(dim + 1, can_tri, key_point);
            //         let born_at = complex.simplex_entering_value(dim, can_index, key_point);
            //         Some(killed_at - born_at)
            //     } else {
            //         None
            //     }
            // };

            // if our_old_persistence.is_some_and(|p| p < EPS)
            //     && our_new_persistence.is_some_and(|p| p < EPS)
            // {
            //     // return Some(false);
            // }

            // for k in 0..i {
            //     if stack.R.col_is_empty(k) {
            //         // we have swapped i, i+1
            //         let old_persistence = { 0.0 };

            //         let new_perstence = { 0.0 };

            //         if old_persistence < EPS && new_perstence < EPS {
            //             return Some(false);
            //         }
            //     }
            // }

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

            for k in 0..i {
                if stack.R.col_is_empty(k) {
                    return Some(false);
                }
            }

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

/// Compute the transpositions required to swap a permutation to become `0..n`.
///
/// Returns a `Vec<usize>` where each element `i` correspond to the transposition
/// `(i, i+1)` taking place.
/// Also return the "column value" of the simplices that were swapped. This is
/// used to figure out which simplices the swap consisted of.
#[cfg_attr(feature = "python", pyfunction)]
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

#[cfg(feature = "python")]
#[pyfunction]
pub fn read_from_obj(p: &str) -> PyResult<Complex> {
    Complex::read_from_obj(p).map_err(PyValueError::new_err)
}

#[cfg(feature = "python")]
fn test_three_points() {
    // This mesh has three vertices: (1, 0), (1, 1), and (0, 1).
    // The first MA thus consists of three lines:
    // ^ Y
    // |
    // X--------||---------X
    // | \      ||      B  |
    // |    \   ||         |
    // |       \||=========|======
    // |     //   \        |
    // |   //        \     |
    // | //   A         \  |   X
    // //------------------X--->
    //

    let complex = read_from_obj("input/three-points.obj").unwrap();
    let point_a = Pos([0.3, 0.1, 0.0]);
    {
        let mut point = point_a;
        let mut state = reduce_from_scratch(&complex, point, false);
        for _ in 0..10 {
            let pt = point + Pos([0.1, 0.0, 0.0]);
            let (next_state, swaps) = vineyards_123(&complex, &state, pt);
            assert_eq!(swaps.v.len(), 0);
            state = next_state;
            point = pt;
            println!("{:?}", swaps);
        }
    }

    let point_b = Pos([0.8, 0.75, 0.0]);
    {
        let mut point = point_b;
        let mut state = reduce_from_scratch(&complex, point, false);
        for k in 0..10 {
            let pt = point - Pos([0.0, 0.1, 0.0]);
            println!("between {:?} and {:?}", point, pt);
            let (next_state, swaps) = vineyards_123(&complex, &state, pt);
            println!("swaps: {:?}", swaps);
            if k == 2 {
                // k=0: 0.75 -- 0.65
                // k=1: 0.65 -- 0.55
                // k=2: 0.55 -- 0.45
                // k=3: 0.45 -- 0.35
                assert!(0 < swaps.v.len());
            } else {
                assert_eq!(swaps.v.len(), 0);
            }
            state = next_state;
            point = pt;
            println!("{:?}", swaps);
        }
    }
}

#[cfg(feature = "python")]
fn test_three_points_test1() {
    let complex = read_from_obj("input/three-points.obj").unwrap();
    let pt_a = Pos([0.8, 0.45, 0.0]);
    let pt_b = Pos([0.8, 0.35, 0.0]);

    let state = reduce_from_scratch(&complex, pt_a, false);
    let (_next_state, swaps) = vineyards_123(&complex, &state, pt_b);
    assert_eq!(swaps.v.len(), 0);
}

#[cfg(feature = "python")]
#[pymodule]
fn mars(_py: Python, m: &PyModule) -> PyResult<()> {
    m.add_function(wrap_pyfunction!(compute_transpositions, m)?)?;
    m.add_function(wrap_pyfunction!(read_from_obj, m)?)?;
    m.add_function(wrap_pyfunction!(reduce_from_scratch, m)?)?;
    m.add_function(wrap_pyfunction!(vineyards_123, m)?)?;
    m.add_function(wrap_pyfunction!(test_three_points, m)?)?;
    m.add_function(wrap_pyfunction!(test_three_points_test1, m)?)?;
    m.add_function(wrap_pyfunction!(json_output, m)?)?;
    m.add_class::<SneakyMatrix>()?;
    m.add_class::<Permutation>()?;
    m.add_class::<Col>()?;
    m.add_class::<Simplex>()?;
    m.add_class::<Complex>()?;
    m.add_class::<Grid>()?;
    m.add_class::<Swaps>()?;
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
