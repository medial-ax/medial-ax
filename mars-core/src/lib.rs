use std::{
    collections::{HashMap, HashSet},
    iter::zip,
};

use complex::{Complex, Pos};
use permutation::Permutation;
use serde::{Deserialize, Serialize};
use sneaky_matrix::{SneakyMatrix, CI};

pub mod complex;
pub mod grid;
pub mod json;
pub mod permutation;
pub mod sneaky_matrix;
pub mod stats;
#[cfg(test)]
pub mod test;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Swap {
    /// Dimension in which the swap happened.
    pub dim: usize,
    /// Canonical index of the first simplex.
    pub i: CI,
    /// Canonical index of the second simplex.
    pub j: CI,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Swaps {
    pub v: Vec<Swap>,
}

impl Swaps {
    pub fn new(v: Vec<Swap>) -> Self {
        Self { v }
    }

    /// Remove all swaps that were done between simplices that are closer than
    /// `min_dist`.
    ///
    /// Useful for 0th MA.
    pub fn prune_euclidian(&mut self, complex: &Complex, min_dist: f64) {
        self.v.retain(|swap| {
            let c1 = complex.simplices_per_dim[swap.dim][swap.i as usize].center_point(complex);
            let c2 = complex.simplices_per_dim[swap.dim][swap.j as usize].center_point(complex);
            let dist = c1.dist2(&c2);
            min_dist < dist
        })
    }

    pub fn prune_common_face(&mut self, complex: &Complex) {
        let mut simp_to_vertices: HashMap<(usize, CI), HashSet<CI>> = HashMap::new();

        for dim in 1..3 {
            for (s, i) in complex.simplices_per_dim[dim].iter().zip(0..) {
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
        let mut coboundary: HashMap<(usize, CI), HashSet<CI>> = HashMap::new();

        for dim in 1..3 {
            for (s, parent_i) in complex.simplices_per_dim[dim].iter().zip(0..) {
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

        fn find_killer(dim: usize, can_id: CI, reduction: &Reduction) -> Option<CI> {
            if reduction.stacks.len() <= dim + 1 {
                return None;
            }
            let ordering = &reduction.stacks[dim].ordering;
            let sorted_i = ordering.map(can_id);
            let killer = reduction.stacks[dim + 1]
                .R
                .col_with_low((sorted_i).try_into().unwrap());
            if let Some(k) = killer {
                let can_k = reduction.stacks[dim + 1].ordering.inv(k);
                Some(can_k)
            } else {
                None
            }
        }

        fn persistence(
            dim: usize,
            can_id: CI,
            reduction: &Reduction,
            distances: &[Vec<f64>],
        ) -> Option<f64> {
            let killer = find_killer(dim, can_id, reduction);
            if let Some(killer) = killer {
                let dist = distances[dim][can_id as usize];
                let killer_dist = distances[dim + 1][killer as usize];
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

#[derive(Clone, Debug, serde::Deserialize, serde::Serialize)]
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

impl Stack {
    pub fn mem_usage(&self) -> usize {
        self.D.mem_usage() + self.R.mem_usage() + self.U_t.mem_usage() + self.ordering.mem_usage()
    }
}

#[derive(Clone, Debug, serde::Serialize)]
pub struct BirthDeathPair {
    /// Dimension of the homology class.
    pub dim: isize,
    /// Birth time and canonical index of the simplex giving birth to the homology class.
    pub birth: Option<(f64, CI)>,
    /// Birth time and canonical index of the simplex giving birth to the homology class.
    pub death: Option<(f64, CI)>,
}

impl BirthDeathPair {
    pub fn lifetime(&self) -> f64 {
        let birth = self.birth.map(|t| t.0).unwrap_or(f64::NEG_INFINITY);
        let death = self.death.map(|t| t.0).unwrap_or(f64::INFINITY);
        death - birth
    }
}

#[derive(Clone, Debug, serde::Deserialize, serde::Serialize)]
pub struct Reduction {
    /// Key point around which the reduction is done.
    pub key_point: Pos,
    pub stacks: [Stack; 3],
}

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
    pub fn simplex_entering_value(&self, complex: &Complex, dim: usize, id: CI) -> f64 {
        let simplex = &complex.simplices_per_dim[dim][id as usize];
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
    fn find_killer(&self, dim: usize, id: CI) -> Option<CI> {
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
    fn find_victim(&self, dim: usize, id: CI) -> Option<CI> {
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
    pub fn persistence(&self, complex: &Complex, dim: usize, id: CI) -> Option<BirthDeathPair> {
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

        let mut vertex_order = (0..complex.simplices_per_dim[0].len() as CI)
            .map(|i| {
                let s = &complex.simplices_per_dim[0][i as usize];
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
        let mut edge_order = (0..complex.simplices_per_dim[1].len() as CI)
            .map(|i| {
                let s = &complex.simplices_per_dim[1][i as usize];
                let ai = s.boundary[0];
                let bi = s.boundary[1];

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

        let mut tri_order = (0..complex.simplices_per_dim[2].len() as CI)
            .map(|i| {
                let s = &complex.simplices_per_dim[2][i as usize];

                let ai = s.boundary[0];
                let bi = s.boundary[1];
                let ci = s.boundary[1];

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
            let dist_a = vertex_distances[e.boundary[0] as usize];
            let dist_b = vertex_distances[e.boundary[1] as usize];
            dist_a.max(dist_b)
        })
        .collect::<Vec<_>>();

    let triangle_distances = complex.simplices_per_dim[2]
        .iter()
        .map(|f| {
            let dist_a = edge_distances[f.boundary[0] as usize];
            let dist_b = edge_distances[f.boundary[1] as usize];
            let dist_c = edge_distances[f.boundary[2] as usize];
            dist_a.max(dist_b).max(dist_c)
        })
        .collect::<Vec<_>>();

    let v_perm = Permutation::from_ord(&vertex_distances);
    let e_perm = Permutation::from_ord(&edge_distances);
    let t_perm = Permutation::from_ord(&triangle_distances);

    (v_perm, e_perm, t_perm)
}

/// Returns a [Vec] with one element per faustian swap. The elements are `(dim,
/// (i, j))` where `dim` is the dimension of the simplices that were swapped,
/// and `i` and `j` are the canonical indices of the swapped simplices.
pub fn vineyards_step(
    complex: &Complex,
    reduction: &Reduction,
    key_point: Pos,
    require_hom_birth_to_be_first: bool,
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

            for i in 0..complex.simplices_per_dim[1].len() as CI {
                for j in 0..i {
                    let dist_a_i = distances_a[1][i as usize];
                    let dist_a_j = distances_a[1][j as usize];
                    let cmp_at_a = dist_a_i.total_cmp(&dist_a_j);

                    let dist_b_i = distances_b[1][i as usize];
                    let dist_b_j = distances_b[1][j as usize];
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

    stack0.ordering = v_perm;

    let state = Reduction {
        key_point,
        stacks: [stack0, stack1, stack2],
    };

    if require_hom_birth_to_be_first {
        // We now have a bunch of faustian swaps.  However, we only want the first "real" cycle for
        // each dimension, meaning it has >0 persistence.  A swap consists of two simplices (A B) where
        // A used to give death, and B used to give birth, that have changed in the new ordering (B A).
        // We look at the persistence of the cycle that is given birth to.
        //
        // Since we're only interested in the first cycle (per dim), we precompute this to figure out
        // which final simplices we're interested in.  For the used-to-give-birth simplex we check
        // the initial input matrix.  For the is-now-giving-birth simplex we check the newly reduced
        // matrix.  Then we go over the swaps and remove those that don't contain either.

        /// Finds the simplex that creates the first homology class in a dimension.
        ///
        /// Returns the canonical index of the simplex.
        fn find_interesting(reduction: &Reduction, complex: &Complex, dim: usize) -> Option<CI> {
            #[allow(non_snake_case)]
            let R = &reduction.stacks[dim].R;

            for ord_i in 0..R.cols {
                if R.col_is_not_empty(ord_i) {
                    continue;
                }
                let can_i = reduction.stacks[dim].ordering.inv(ord_i);
                let Some(p) = reduction.persistence(complex, dim, can_i) else {
                    continue;
                };
                if 1e-6 < p.lifetime() {
                    return Some(can_i);
                }
            }

            None
        }

        unimplemented!();
        // TODO: range 0..3
        for dim in 1..2 {
            let old_interesting_edge = find_interesting(reduction, complex, dim);
            let new_interesting_edge = find_interesting(&state, complex, dim);

            if let Some((min, max)) = old_interesting_edge
                .zip(new_interesting_edge)
                .map(|(o, n)| (o.min(n), o.max(n)))
            {
                faustian_swap_simplices
                    .retain(|p| p.dim != 1 || p.i.min(p.j) == min || p.i.max(p.j) == max);
            }
        }
    }

    (
        state,
        Swaps {
            v: faustian_swap_simplices,
        },
    )
}

#[allow(non_snake_case)]
pub fn reduce_from_scratch(complex: &Complex, key_point: Pos, noisy: bool) -> Reduction {
    let (mut v_perm, mut e_perm, mut t_perm) = compute_permutations(complex, key_point);

    let mut boundary_0 = complex.boundary_matrix(0);
    boundary_0.col_perm = Some(v_perm.clone());
    let D0 = boundary_0.clone();

    let mut boundary_1 = complex.boundary_matrix(1);
    boundary_1.col_perm = Some(e_perm.clone());
    boundary_1.row_perm = Some(v_perm.clone());
    let D1 = boundary_1.clone();

    let mut boundary_2 = complex.boundary_matrix(2);
    boundary_2.col_perm = Some(t_perm.clone());
    boundary_2.row_perm = Some(e_perm.clone());
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
    let U_t0 = V0.inverse_gauss_jordan().transpose();
    if noisy {
        print!("done\nInvert V1 ... ");
    }
    let U_t1 = V1.inverse_gauss_jordan().transpose();
    if noisy {
        print!("done\nInvert V2 ... ");
    }
    let U_t2 = V2.inverse_gauss_jordan().transpose();
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
    i: CI,
    stack: &mut Stack,
    up_stack: &mut Stack,
    old_stack: &Stack,
    old_stack_above: &Stack,
    complex: &Complex,
    dim: usize,
    key_point: Pos,
) -> Option<bool> {
    #[allow(non_snake_case)]
    fn gives_death(R: &SneakyMatrix, c: CI) -> bool {
        R.col_is_not_empty(c)
    }

    #[allow(non_snake_case)]
    fn low(R: &SneakyMatrix, c: CI) -> Option<CI> {
        R.colmax(c)
    }

    #[allow(non_snake_case)]
    fn low_inv(R: &SneakyMatrix, r: CI) -> Option<CI> {
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
fn perform_one_swap_top_dim(i: CI, stack: &mut Stack) -> Option<bool> {
    #[allow(non_snake_case)]
    fn gives_death(R: &SneakyMatrix, c: CI) -> bool {
        R.col_is_not_empty(c)
    }

    #[allow(non_snake_case)]
    fn low(R: &SneakyMatrix, c: CI) -> Option<CI> {
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
pub fn compute_transpositions(mut b: Vec<CI>) -> (Vec<CI>, Vec<(CI, CI)>) {
    // NOTE: The `this` ordering is implicitly `0..n`.
    let n = b.len();
    let n0 = zip(&b, 0..n)
        .position(|(&aa, bb)| aa as usize != bb)
        .unwrap_or(n) as CI;
    let n1 = zip(&b, 0..n)
        .rposition(|(&aa, bb)| aa as usize != bb)
        .unwrap_or(n) as CI;
    let mut ret = Vec::with_capacity(n);
    let mut swapped_indices = Vec::with_capacity(n);
    for _ in n0..=n1 {
        let mut swap = false;
        for i in 0..(n - 1) {
            if b[i] > b[i + 1] {
                ret.push(i as CI);
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

    use crate::test::*;

    #[test]
    fn snapshot_medial_axes_for_grid() {
        let complex = test_complex_cube();
        let grid = test_grid_for_cube();

        let state =
            run_without_prune_inner(Some(grid), None, complex, Default::default(), |_, _, _| {})
                .unwrap();

        let pruning_params_dim0 = default_pruning_param_dim0();
        let pruned0 = prune(&state, &pruning_params_dim0, 0, |_, _, _| {});
        let mut ma0_indices = vec![];
        for (i, j, swaps) in pruned0 {
            if swaps.v.len() > 0 {
                ma0_indices.push((i.min(j), i.max(j)));
            }
        }
        ma0_indices.sort();
        insta::assert_json_snapshot!(ma0_indices);

        let pruning_params_dim1 = default_pruning_param_dim1();
        let pruned1 = prune(&state, &pruning_params_dim1, 1, |_, _, _| {});
        let mut ma1_indices = vec![];
        for (i, j, swaps) in pruned1 {
            if swaps.v.len() > 0 {
                ma1_indices.push((i.min(j), i.max(j)));
            }
        }
        ma1_indices.sort();
        insta::assert_json_snapshot!(ma1_indices);

        let pruning_params_dim2 = default_pruning_param_dim2();
        let pruned2 = prune(&state, &pruning_params_dim2, 2, |_, _, _| {});
        let mut ma2_indices = vec![];
        for (i, j, swaps) in pruned2 {
            if swaps.v.len() > 0 {
                ma2_indices.push((i.min(j), i.max(j)));
            }
        }
        ma2_indices.sort();
        insta::assert_json_snapshot!(ma2_indices);
    }
}
