use std::collections::{HashMap, HashSet};

use tracing::{info, instrument, trace};

use crate::{
    complex::{Complex, Pos},
    reduce_from_scratch, vineyards_step, Reduction, Swaps,
};

#[derive(
    Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, serde::Serialize, serde::Deserialize,
)]
pub struct Index(pub [isize; 3]);

impl Index {
    /// Make a fake index. Used for [VineyardsGridMesh], where we don't have real [Index]es for the
    /// points, but to be API compatible with [VineyardsGrid] we pretend that we do.
    pub fn fake(n: isize) -> Self {
        Self([n, 0, 0])
    }

    /// Get the first component of the index.
    fn x(&self) -> isize {
        self.0[0]
    }

    fn y(&self) -> isize {
        self.0[1]
    }

    fn z(&self) -> isize {
        self.0[2]
    }
}

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

impl std::fmt::Debug for Index {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_fmt(format_args!(
            "[{}, {}, {}]",
            self.0[0], self.0[1], self.0[2]
        ))
    }
}

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct VineyardsGrid {
    pub corner: Pos,
    pub size: f64,
    pub shape: Index,
    /// Should always be `"grid"`. Used for serialization stuff.
    pub r#type: String,
}

impl VineyardsGrid {
    pub fn new(corner: Pos, size: f64, shape: [isize; 3]) -> Self {
        VineyardsGrid {
            corner,
            size,
            shape: Index(shape),
            r#type: "grid".to_string(),
        }
    }

    /// Construct a new [Grid] around the given [Complex]. The grid cells are of
    /// size `size`, and `buffer` is the smallest distance from the grid
    /// boundary to the complex.  This is tight at the min corner of the grid,
    /// and is up to `buffer + size` as the max corner of the grid.
    pub fn around_complex(complex: &Complex, size: f64, buffer: f64) -> Self {
        let (xmin, ymin, zmin) = complex.simplices_per_dim[0].iter().fold(
            (f64::MAX, f64::MAX, f64::MAX),
            |acc, simplex| {
                let [x, y, z] = simplex.coords.unwrap().0;
                (acc.0.min(x), acc.1.min(y), acc.2.min(z))
            },
        );

        let (xmax, ymax, zmax) = complex.simplices_per_dim[0].iter().fold(
            (f64::MIN, f64::MIN, f64::MIN),
            |acc, simplex| {
                let [x, y, z] = simplex.coords.unwrap().0;
                (acc.0.max(x), acc.1.max(y), acc.2.max(z))
            },
        );

        let corner = Pos([xmin - buffer, ymin - buffer, zmin - buffer]);

        let shape = [
            ((xmax - xmin + 2.0 * buffer) / size).ceil() as isize,
            ((ymax - ymin + 2.0 * buffer) / size).ceil() as isize,
            ((zmax - zmin + 2.0 * buffer) / size).ceil() as isize,
        ];

        Self::new(corner, size, shape)
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

    pub fn closest_index_of(&self, p: Pos) -> Index {
        let mut arr = [0; 3];
        for j in 0..3 {
            arr[j] = ((p.0[j] - self.corner.0[j]) / self.size).round() as isize;
        }
        Index(arr)
    }

    /// Returns the coordinate of the lower corner of the cell.
    pub fn coordinate(&self, i: Index) -> Pos {
        let mut arr = [0.0; 3];
        for j in 0..3 {
            arr[j] = self.corner.0[j] + self.size * i.0[j] as f64;
        }
        Pos(arr)
    }

    pub fn volume(&self) -> isize {
        self.shape.0[0] * self.shape.0[1] * self.shape.0[2]
    }

    pub fn dual_quad_points(&self, a: Index, b: Index) -> [Pos; 4] {
        let pa = self.coordinate(a);
        let pb = self.coordinate(b);
        let middle = (pa + pb) / 2.0;

        let size = self.size / 2.0;

        if a.x() != b.x() {
            [
                Pos([middle.x(), middle.y() - size, middle.z() - size]), // ll
                Pos([middle.x(), middle.y() - size, middle.z() + size]), // lr
                Pos([middle.x(), middle.y() + size, middle.z() + size]), // ur
                Pos([middle.x(), middle.y() + size, middle.z() - size]), // ul
            ]
        } else if a.y() != b.y() {
            [
                Pos([middle.x() - size, middle.y(), middle.z() - size]),
                Pos([middle.x() - size, middle.y(), middle.z() + size]),
                Pos([middle.x() + size, middle.y(), middle.z() + size]),
                Pos([middle.x() + size, middle.y(), middle.z() - size]),
            ]
        } else if a.z() != b.z() {
            [
                Pos([middle.x() - size, middle.y() - size, middle.z()]),
                Pos([middle.x() - size, middle.y() + size, middle.z()]),
                Pos([middle.x() + size, middle.y() + size, middle.z()]),
                Pos([middle.x() + size, middle.y() - size, middle.z()]),
            ]
        } else {
            panic!("dual_quad_face: a == b");
        }
    }

    /// Splits the grid into two along the longest axis.
    /// The [Index] returned is the offset of the second [Grid] wrt. the first [Grid].
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
                Index([wmin, 0, 0]),
            )
        } else if w <= h && d <= h {
            let hmin = h / 2;
            let hmax = h - hmin;
            (
                Self::new(self.corner, self.size, [w, hmin + 1, d]),
                Self::new(
                    self.coordinate(Index([0, hmin, 0])),
                    self.size,
                    [w, hmax, d],
                ),
                Index([0, hmin, 0]),
            )
        } else {
            let dmin = d / 2;
            let dmax = d - dmin;
            (
                Self::new(self.corner, self.size, [w, h, dmin + 1]),
                Self::new(
                    self.coordinate(Index([0, 0, dmin])),
                    self.size,
                    [w, h, dmax],
                ),
                Index([0, 0, dmin]),
            )
        }
    }

    pub fn number_of_grid_edges(&self) -> isize {
        self.shape.0[0] * self.shape.0[1] * (self.shape.0[2] - 1)
            + self.shape.0[0] * (self.shape.0[1] - 1) * self.shape.0[2]
            + (self.shape.0[0] - 1) * self.shape.0[1] * self.shape.0[2]
    }

    /// Run vineyards across all edges of the grid.  
    pub fn run_vineyards_in_grid<F: Fn(usize, usize)>(
        &self,
        complex: &Complex,
        i0: Index,
        state: Reduction,
        require_hom_birth_to_be_first: bool,
        on_visit: F,
    ) -> (HashMap<Index, Reduction>, Vec<(Index, Index, Swaps)>) {
        let mut hm = HashMap::new();
        let mut all_swaps = Vec::new();

        let num_grid_edges = self.number_of_grid_edges() as usize;
        let mut edge_i = 0;

        self.visit_edges(i0, |new_cell, old_cell| {
            edge_i += 1;
            on_visit(edge_i, num_grid_edges);

            if let Some(old_cell) = old_cell {
                let old_state = hm
                    .get(&old_cell)
                    .expect("prev_cell should have state in the map.");
                let p = self.coordinate(new_cell);
                let (new_state, swaps) =
                    vineyards_step(complex, old_state, p, require_hom_birth_to_be_first);
                all_swaps.push((old_cell, new_cell, swaps));
                hm.insert(new_cell, new_state);
            } else {
                hm.insert(new_cell, state.clone());
            }
        });
        (hm, all_swaps)
    }

    /// True if the index is contained in the grid.
    fn contains(&self, index: &Index) -> bool {
        let [x, y, z] = index.0;
        x >= 0
            && x < self.shape.0[0]
            && y >= 0
            && y < self.shape.0[1]
            && z >= 0
            && z < self.shape.0[2]
    }

    /// Iterate over the at most 6 neighbors of a cell.
    fn iter_neighbors(&self, index: &Index) -> impl Iterator<Item = Index> + '_ {
        let [x, y, z] = index.0;
        [
            Index([x + 1, y, z]),
            Index([x - 1, y, z]),
            Index([x, y + 1, z]),
            Index([x, y - 1, z]),
            Index([x, y, z + 1]),
            Index([x, y, z - 1]),
        ]
        .into_iter()
        .filter(|i| self.contains(i))
    }

    /// Visit each edge of the grid.
    ///
    /// The two endpoints of each edge is passed as parameters to `f`.  The first [Index] is a
    /// potentially new [Index] that we haven't visited before.  The second parameter is the
    /// [Index] of the vertex that we have visited before, unless it is the very first edge we
    /// visit.
    pub fn visit_edges<F: FnMut(Index, Option<Index>)>(&self, start: Index, mut f: F) {
        let mut queue = std::collections::VecDeque::new();
        queue.push_back((start, None));

        let mut visited = std::collections::HashSet::new();

        while let Some((next, prev)) = queue.pop_front() {
            let was_visited = visited.contains(&next);
            visited.insert(next);

            f(next, prev);

            if !was_visited {
                for neighbor in self.iter_neighbors(&next) {
                    if !visited.contains(&neighbor) {
                        queue.push_back((neighbor, Some(next)));
                    }
                }
            }
        }
    }
}

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct Bbox(Pos, Pos);

impl Bbox {
    fn span_x(&self) -> f64 {
        (self.1 - self.0).x()
    }
    fn span_y(&self) -> f64 {
        (self.1 - self.0).y()
    }
    fn span_z(&self) -> f64 {
        (self.1 - self.0).z()
    }

    fn mid_x(&self) -> f64 {
        self.0.x() + self.span_x() / 2.0
    }
    fn mid_y(&self) -> f64 {
        self.0.y() + self.span_y() / 2.0
    }
    fn mid_z(&self) -> f64 {
        self.0.z() + self.span_z() / 2.0
    }
}

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct VineyardsGridMesh {
    pub points: Vec<Pos>,
    /// Map from vertex index to the list of its neighbors.
    pub neighbors: Vec<Vec<isize>>,
    /// Should always be `"meshgrid"`. Used for serialization stuff.
    pub r#type: String,
}

impl VineyardsGridMesh {
    pub fn empty() -> Self {
        Self {
            points: Vec::new(),
            neighbors: Vec::new(),
            r#type: "meshgrid".to_string(),
        }
    }

    pub fn coordinate(&self, index: Index) -> Pos {
        self.points[index.0[0] as usize]
    }

    pub fn dual_quad_points(&self, a: Index, b: Index) -> [Pos; 4] {
        let a = self.points[a.0[0] as usize];
        let b = self.points[b.0[0] as usize];
        let dist = a.dist(&b);

        let [ax, ay, az] = a.0;
        let [bx, by, bz] = b.0;
        let middle = a + (b - a) / 2.0;
        let ret: [Pos; 4] = if (ax - bx).abs() > 1e-3 {
            let p = Pos([0.0, dist / 2.0, 0.0]);
            let q = Pos([0.0, 0.0, dist / 2.0]);
            [
                middle - p - q,
                middle - p + q,
                middle + p + q,
                middle + p - q,
            ]
        } else if (ay - by).abs() > 1e-3 {
            let p = Pos([dist / 2.0, 0.0, 0.0]);
            let q = Pos([0.0, 0.0, dist / 2.0]);
            [
                middle - p - q,
                middle - p + q,
                middle + p + q,
                middle + p - q,
            ]
        } else if (az - bz).abs() > 1e-3 {
            let p = Pos([dist / 2.0, 0.0, 0.0]);
            let q = Pos([0.0, dist / 2.0, 0.0]);
            [
                middle - p - q,
                middle - p + q,
                middle + p + q,
                middle + p - q,
            ]
        } else {
            panic!("bad points {:?} {:?}", a, b);
        };
        ret
    }

    /// Lower- and upper corner of the bounding box.
    pub fn bbox_without_singletons(&self) -> Bbox {
        let mut minx = f64::MAX;
        let mut miny = f64::MAX;
        let mut minz = f64::MAX;
        let mut maxx = f64::MIN;
        let mut maxy = f64::MIN;
        let mut maxz = f64::MIN;
        for (i, p) in self.points.iter().enumerate() {
            if self
                .neighbors
                .get(i)
                .map(|ref v| v.len() == 0)
                .unwrap_or(true)
            {
                continue;
            }
            let [x, y, z] = p.0;
            minx = minx.min(x);
            miny = miny.min(y);
            minz = minz.min(z);
            maxx = maxx.max(x);
            maxy = maxy.max(y);
            maxz = maxz.max(z);
        }

        Bbox(Pos([minx, miny, minz]), Pos([maxx, maxy, maxz]))
    }

    #[instrument(skip_all)]
    pub fn split_in_half(&self) -> (Self, Self) {
        let bbox = self.bbox_without_singletons();
        let (dim_i, lim) = {
            let dx = bbox.span_x();
            let dy = bbox.span_y();
            let dz = bbox.span_z();
            if dy <= dx && dz <= dx {
                (0, bbox.mid_x())
            } else if dx <= dy && dz <= dy {
                (1, bbox.mid_y())
            } else {
                (2, bbox.mid_z())
            }
        };

        let mut lower_edges: Vec<Vec<isize>> = vec![Vec::new(); self.neighbors.len()];
        let mut upper_edges: Vec<Vec<isize>> = vec![Vec::new(); self.neighbors.len()];

        for (v, neighbors) in self.neighbors.iter().enumerate() {
            let v_is_lower = self.points[v as usize].0[dim_i] <= lim;
            for &w in neighbors {
                let w_is_lower = self.points[w as usize].0[dim_i] <= lim;
                if v_is_lower || w_is_lower {
                    lower_edges[v].push(w);
                } else {
                    upper_edges[v].push(w);
                }
            }
        }

        trace!("split {} / {}", lower_edges.len(), upper_edges.len());

        (
            VineyardsGridMesh {
                points: self.points.clone(),
                neighbors: lower_edges,
                r#type: self.r#type.clone(),
            },
            VineyardsGridMesh {
                points: self.points.clone(),
                neighbors: upper_edges,
                r#type: self.r#type.clone(),
            },
        )
    }

    pub fn run_vineyards<F: Fn(usize, usize)>(
        &self,
        complex: &Complex,
        require_hom_birth_to_be_first: bool,
        record_progress: F,
    ) -> (HashMap<Index, Reduction>, Vec<(Index, Index, Swaps)>) {
        let mut reductions: HashMap<Index, Reduction> = HashMap::new();
        let mut all_swaps: Vec<(Index, Index, Swaps)> = Vec::new();

        if self.points.len() == 0 {
            return (HashMap::new(), Vec::new());
        }
        let mut seen_vx = HashSet::<isize>::new();

        // Find a component in the meshgrid that we haven't reached yet.
        // `i0` is any node in this component.
        while let Some(i0) = self
            .neighbors
            .iter()
            .enumerate()
            .filter(|(v, _)| !seen_vx.contains(&(*v as isize)))
            .find(|(_, n)| n.len() > 0)
            .map(|(v, _)| v as isize)
        {
            seen_vx.insert(i0);
            let i0 = Index::fake(i0 as isize);
            let reduction_at_0 = reduce_from_scratch(&complex, self.points[i0.x() as usize], false);
            reductions.insert(i0, reduction_at_0);

            let mut stack = self
                .neighbors
                .get(i0.x() as usize)
                .unwrap()
                .iter()
                .map(|n| (Index::fake(*n), i0))
                .collect::<Vec<_>>();

            let mut loop_i = 0;
            let num_edges = self
                .neighbors
                .iter()
                .map(|v| v.len() as usize)
                .sum::<usize>()
                / 2;

            while let Some((next, from)) = stack.pop() {
                seen_vx.insert(next.x());
                loop_i += 1;
                record_progress(loop_i, num_edges);

                let old_state = reductions.get(&from).expect("from should be in the map");
                let p = self.coordinate(next);
                let (new_state, swaps) =
                    vineyards_step(complex, old_state, p, require_hom_birth_to_be_first);
                all_swaps.push((from, next, swaps));

                if !reductions.contains_key(&next) {
                    reductions.insert(next, new_state);
                    for neighbor in self.neighbors.get(next.x() as usize).unwrap() {
                        if !seen_vx.contains(neighbor) {
                            stack.push((Index::fake(*neighbor), next));
                        }
                    }
                }
            }
        }

        (reductions, all_swaps)
    }

    pub fn read_from_obj_string(s: &str) -> Result<Self, String> {
        let mut points: Vec<Pos> = Vec::new();
        let mut edges: Vec<(isize, isize)> = Vec::new();

        for line in s.lines() {
            let line = line.trim();
            if line.starts_with("#")
                || line.starts_with("mtllib")
                || line.starts_with("o")
                || line.starts_with("s")
            {
                continue;
            } else if line.starts_with("v") {
                let groups = line.split_ascii_whitespace().collect::<Vec<_>>();
                let x = groups
                    .get(1)
                    .ok_or("missing field".to_string())
                    .and_then(|n| n.parse::<f64>().map_err(|e| e.to_string()))?;
                let y = groups
                    .get(2)
                    .ok_or("missing field".to_string())
                    .and_then(|n| n.parse::<f64>().map_err(|e| e.to_string()))?;
                let z = groups
                    .get(3)
                    .ok_or("missing field".to_string())
                    .and_then(|n| n.parse::<f64>().map_err(|e| e.to_string()))?;
                let coords = Pos([x, y, z]);
                points.push(coords);
            } else if line.starts_with("l") {
                let groups = line.split_ascii_whitespace().collect::<Vec<_>>();
                let from = groups
                    .get(1)
                    .ok_or("missing field".to_string())
                    .and_then(|n| n.parse::<isize>().map_err(|e| e.to_string()))?;
                let to = groups
                    .get(2)
                    .ok_or("missing field".to_string())
                    .and_then(|n| n.parse::<isize>().map_err(|e| e.to_string()))?;
                edges.push((from - 1, to - 1));
            }
        }

        let mut neighbors: Vec<Vec<isize>> = vec![Vec::new(); points.len()];
        for (from, to) in edges {
            neighbors[from as usize].push(to);
            neighbors[to as usize].push(from);
        }

        Ok(Self {
            points,
            neighbors,
            r#type: "meshgrid".to_string(),
        })
    }

    pub fn write_as_obj<W: std::io::Write>(&self, mut w: W) -> std::io::Result<()> {
        writeln!(w, "o grid")?;

        for pt in &self.points {
            writeln!(w, "v {} {} {}", pt.x(), pt.y(), pt.z())?;
        }

        for (a, neighs) in self.neighbors.iter().enumerate() {
            for b in neighs {
                // Skip these to avoid double outputting
                if *b < a as isize {
                    continue;
                }

                writeln!(w, "l {} {}", a + 1, b + 1)?;
            }
        }

        Ok(())
    }
}
