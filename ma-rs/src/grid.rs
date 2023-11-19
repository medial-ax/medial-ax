use crate::complex::Pos;

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
        pyo3::types::PyList::new(py, &self.0).into()
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

    fn run_state(&mut self, max_volume: isize) {
        if self.volume() <= max_volume {
            println!("sleep {:?}", rayon::current_thread_index());

            std::thread::sleep(std::time::Duration::from_millis(1000));

            // let [w, h, d] = self.shape.0;
            // p
            // for i in 0..w {
            //     for j in 0..h {
            //         for k in 0..d {
            //             self.cell_states
            //                 .insert(Index([i, j, k]), format!("{} {} {}", i, j, k));
            //         }
            //     }
            // }
        } else {
            let (mut left, mut right, offset_index) = self.split_with_overlap();
            rayon::join(
                || left.run_state(max_volume),
                || right.run_state(max_volume),
            );
            self.cell_states = left.cell_states;
            for (k, v) in right.cell_states.into_iter() {
                let k = k + offset_index;
                self.cell_states.insert(k, v);
            }
        }
    }
}

impl Grid {
    pub fn visit_edges<F: Fn(Index, Option<Index>)>(&self, start: Index, f: F) {
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
