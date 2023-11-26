use std::collections::HashMap;

use crate::{
    complex::{Complex, Pos},
    reduce_from_scratch, vineyards_123, Reduction, Swaps,
};

#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct Index(pub [isize; 3]);

impl std::ops::Add<Index> for Index {
    type Output = Index;
    fn add(self, rhs: Index) -> Index {
        let mut arr = [0; 3];
        for i in 0..3 {
            arr[i] = self.0[i] + rhs.0[i];
        }
        Index(arr)
    }
}

impl pyo3::IntoPy<pyo3::PyObject> for Index {
    fn into_py(self, py: pyo3::Python<'_>) -> pyo3::PyObject {
        pyo3::types::PyTuple::new(py, &self.0).into()
    }
}

impl<'source> pyo3::FromPyObject<'source> for Index {
    fn extract(ob: &'source pyo3::PyAny) -> pyo3::PyResult<Self> {
        ob.downcast::<pyo3::types::PyList>()
            .map_err(|_| pyo3::PyErr::new::<pyo3::exceptions::PyTypeError, _>("expected list"))
            .and_then(|l| {
                if l.len() != 3 {
                    return Err(pyo3::PyErr::new::<pyo3::exceptions::PyValueError, _>(
                        "expected list of length 3",
                    ));
                }
                let mut arr = [0; 3];
                for i in 0..3 {
                    arr[i] = l.get_item(i)?.extract()?;
                }
                Ok(Index(arr))
            })
    }
}

impl std::fmt::Debug for Index {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_fmt(format_args!(
            "[{}, {}, {}]",
            self.0[0], self.0[1], self.0[2]
        ))
    }
}

#[pyo3::pyclass(get_all)]
pub struct Grid {
    pub corner: Pos,
    pub size: f64,
    pub shape: Index,

    pub cell_states: std::collections::HashMap<Index, String>,
}

#[pyo3::pymethods]
impl Grid {
    #[staticmethod]
    pub fn new(corner: Pos, size: f64, shape: [isize; 3]) -> Self {
        Grid {
            corner,
            size,
            shape: Index(shape),
            cell_states: std::collections::HashMap::new(),
        }
    }

    pub fn center(&self, i: Index) -> Pos {
        let mut arr = [0.0; 3];
        for j in 0..3 {
            arr[j] = self.corner.0[j] + self.size * (i.0[j] as f64 + 0.5);
        }
        Pos(arr)
    }

    pub fn is_on_boundary(&self, i: Index) -> bool {
        for j in 0..3 {
            if i.0[j] == 0 || i.0[j] == self.shape.0[j] - 1 {
                return true;
            }
        }
        false
    }

    pub fn center_index(&self) -> Index {
        let mut arr = [0; 3];
        for j in 0..3 {
            arr[j] = (self.shape.0[j] - 1) / 2;
        }
        Index(arr)
    }

    fn coordinate(&self, i: Index) -> Pos {
        let mut arr = [0.0; 3];
        for j in 0..3 {
            arr[j] = self.corner.0[j] + self.size * i.0[j] as f64;
        }
        Pos(arr)
    }

    pub fn volume(&self) -> isize {
        self.shape.0[0] * self.shape.0[1] * self.shape.0[2]
    }

    /// Splits the grid into two along the longest axis.
    pub fn split_with_overlap(&self) -> (Self, Self, Index) {
        let [w, h, d] = self.shape.0;
        if h <= w && d <= w {
            let wmin = w / 2;
            let wmax = w - wmin;
            (
                Self::new(self.corner, self.size, [wmin + 1, h, d]),
                Self::new(
                    self.coordinate(Index([wmin, 0, 0])),
                    self.size,
                    [wmax, h, d],
                ),
                Index([wmax, 0, 0]),
            )
        } else if w <= h && d <= h {
            let hmin = h / 2;
            let hmax = h - hmin;
            (
                Self::new(self.corner, self.size, [w, hmin + 1, d]),
                Self::new(
                    self.coordinate(Index([0, hmax, 0])),
                    self.size,
                    [w, hmax, d],
                ),
                Index([0, hmax, 0]),
            )
        } else {
            let dmin = d / 2;
            let dmax = d - dmin;
            (
                Self::new(self.corner, self.size, [w, h, dmin + 1]),
                Self::new(
                    self.coordinate(Index([0, 0, dmax])),
                    self.size,
                    [w, h, dmax],
                ),
                Index([0, 0, dmax]),
            )
        }
    }

    pub fn number_of_grid_edges(&self) -> isize {
        self.shape.0[0] * self.shape.0[1] * (self.shape.0[2] - 1)
            + self.shape.0[0] * (self.shape.0[1] - 1) * self.shape.0[2]
            + (self.shape.0[0] - 1) * self.shape.0[1] * self.shape.0[2]
    }

    /// Run vineyards across all edges of the grid.  
    fn run_vineyards_in_grid(
        &self,
        complex: &Complex,
    ) -> (HashMap<Index, Reduction>, Vec<(Index, Index, Swaps)>) {
        let mut hm = HashMap::new();
        let mut all_swaps = Vec::new();

        let mut edges_visited = 0;
        let total_edges = self.number_of_grid_edges();

        self.visit_edges(Index([0; 3]), |new_cell, old_cell| {
            let last_percent = (100.0 * edges_visited as f64 / total_edges as f64).floor();
            edges_visited += 1;
            let this_percent = (100.0 * edges_visited as f64 / total_edges as f64).floor();
            // if last_percent != this_percent {
            //     eprint!(
            //         "Progress: {}/{} ({}%)\r",
            //         edges_visited, total_edges, this_percent
            //     );
            // }

            if let Some(old_cell) = old_cell {
                let old_state = hm
                    .get(&old_cell)
                    .expect("prev_cell should have state in the map.");
                let p = self.center(new_cell);
                let (new_state, swaps) = vineyards_123(complex, old_state, p);
                all_swaps.push((old_cell, new_cell, swaps));
                hm.insert(new_cell, new_state);
            } else {
                let p = self.center(new_cell);
                let state = reduce_from_scratch(complex, p);
                hm.insert(new_cell, state);
            }
        });
        (hm, all_swaps)
    }

    fn run_state(&mut self, max_volume: isize, complex: &Complex) -> Vec<(Index, Index, Swaps)> {
        fn inner(
            grid: &mut Grid,
            max_volume: isize,
            complex: &Complex,
        ) -> Vec<(Index, Index, Swaps)> {
            if grid.volume() <= max_volume {
                let t0 = std::time::Instant::now();
                let (_, swaps) = grid.run_vineyards_in_grid(complex);
                let t1 = std::time::Instant::now();
                let dt = t1 - t0;
                let dt = dt.as_secs() as f64 + dt.subsec_nanos() as f64 * 1e-9;
                eprintln!(
                    "t{:02} run_vineyards_in_grid: {} seconds",
                    rayon::current_thread_index().unwrap(),
                    dt,
                );
                return swaps;
            } else {
                let (mut left, mut right, offset_index) = grid.split_with_overlap();
                let (mut left_swaps, right_swaps) = rayon::join(
                    || left.run_state(max_volume, complex),
                    || right.run_state(max_volume, complex),
                );

                left_swaps.reserve(right_swaps.len());
                for s in right_swaps {
                    left_swaps.push((s.0 + offset_index, s.1 + offset_index, s.2));
                }

                return left_swaps;
            }
        }

        pyo3::Python::with_gil(|py| py.allow_threads(|| inner(self, max_volume, complex)))
    }
}

impl Grid {
    pub fn visit_edges<F: FnMut(Index, Option<Index>)>(&self, start: Index, mut f: F) {
        let mut queue = std::collections::VecDeque::new();
        queue.push_back((start, None));

        let mut visited = std::collections::HashSet::new();

        while let Some((next, prev)) = queue.pop_front() {
            let was_visited = visited.contains(&next);
            visited.insert(next);

            f(next, prev);

            if !was_visited {
                for neighbor in [
                    [next.0[0] + 1, next.0[1], next.0[2]],
                    [next.0[0] - 1, next.0[1], next.0[2]],
                    [next.0[0], next.0[1] + 1, next.0[2]],
                    [next.0[0], next.0[1] - 1, next.0[2]],
                    [next.0[0], next.0[1], next.0[2] + 1],
                    [next.0[0], next.0[1], next.0[2] - 1],
                ]
                .iter()
                .filter(|&i| {
                    i[0] >= 0
                        && i[0] < self.shape.0[0]
                        && i[1] >= 0
                        && i[1] < self.shape.0[1]
                        && i[2] >= 0
                        && i[2] < self.shape.0[2]
                })
                .map(|&i| Index(i))
                {
                    if !visited.contains(&neighbor) {
                        queue.push_back((neighbor, Some(next)));
                    }
                }
            }
        }
    }
}
