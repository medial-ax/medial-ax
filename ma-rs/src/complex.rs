use std::collections::HashMap;

use crate::SneakyMatrix;

#[derive(Debug, Clone, Copy)]
#[pyo3::pyclass]
pub struct Pos([f64; 3]);

impl Pos {
    pub fn dist(&self, other: &Pos) -> f64 {
        let mut sum = 0.0;
        for i in 0..3 {
            sum += (self.0[i] - other.0[i]).powi(2);
        }
        sum.sqrt()
    }
}

#[derive(Debug, Clone)]
#[pyo3::pyclass]
pub struct Simplex {
    /// Unique identifier of the simplex.  This is only unique within the dimension for the complex it is in.
    pub id: usize,
    /// Coordinates of the simplex, if any.
    pub coords: Option<Pos>,
    /// The boundary of the simplex, i.e. the indices of the faces.
    pub boundary: Vec<usize>,
}

impl Simplex {
    pub fn dim(&self) -> isize {
        self.boundary.len() as isize - 1
    }
}

#[derive(Debug, Clone)]
#[pyo3::pyclass]
pub struct Complex {
    pub simplices_per_dim: Vec<Vec<Simplex>>,

    pub coboundary_map: Vec<Vec<usize>>,
}

impl Complex {
    pub fn num_simplices_of_dim(&self, dim: isize) -> usize {
        if dim == -1 {
            return 1;
        }
        self.simplices_per_dim[dim as usize].len()
    }

    /// Returns a [SneakyMatrix] of the boundary map from dimension `dim` to `dim - 1`.
    pub fn boundary_matrix(&self, dim: isize) -> SneakyMatrix {
        assert!(dim >= 0);
        let n = self.num_simplices_of_dim(dim);
        let m = self.num_simplices_of_dim(dim - 1);
        let mut sm = SneakyMatrix::zeros(m, n);
        for s in self.simplices_per_dim[dim as usize].iter() {
            for j in &s.boundary {
                sm.set(*j, s.id, true);
            }
        }
        sm
    }

    pub fn read_from_obj<P: AsRef<std::path::Path>>(p: P) -> Result<Self, String> {
        let input_str =
            std::fs::read_to_string(p).map_err(|e| format!("Error reading file: {}", e))?;

        let mut vertices: Vec<Simplex> = Vec::new();
        let mut edges: Vec<Simplex> = Vec::new();
        let mut triangles: Vec<Simplex> = Vec::new();

        // Map (i, j) to edge simplex index.
        let mut edge_map = HashMap::<(usize, usize), usize>::new();

        for line in input_str.lines() {
            let line = line.trim();
            if line.starts_with("#")
                || line.starts_with("mtllib")
                || line.starts_with("o")
                || line.starts_with("s")
            {
                continue;
            } else if line.starts_with("v") {
                // v -0.039375 1.021144 0.000000
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
                vertices.push(Simplex {
                    id: vertices.len(),
                    coords: Some(coords),
                    boundary: Vec::new(),
                });
            } else if line.starts_with("l") {
                // l 1 2
                let groups = line.split_ascii_whitespace().collect::<Vec<_>>();
                let a = groups
                    .get(1)
                    .ok_or("missing field".to_string())
                    .and_then(|n| n.parse::<usize>().map_err(|e| e.to_string()))?
                    - 1; // NOTE: .obj is 1-indexed

                let b = groups
                    .get(2)
                    .ok_or("missing field".to_string())
                    .and_then(|n| n.parse::<usize>().map_err(|e| e.to_string()))?
                    - 1; // NOTE: .obj is 1-indexed

                let id = edges.len();

                let (a, b) = (a.min(b), a.max(b));

                if edge_map.contains_key(&(a, b)) {
                    panic!("Duplicate edge entries in the .obj");
                }

                edge_map.insert((a, b), id);

                edges.push(Simplex {
                    id,
                    coords: None,
                    boundary: vec![a, b],
                });
            } else if line.starts_with("f") {
                // f 20 27 19
                let groups = line.split_ascii_whitespace().collect::<Vec<_>>();
                let a = groups
                    .get(1)
                    .ok_or("missing field".to_string())
                    .and_then(|n| n.parse::<usize>().map_err(|e| e.to_string()))?
                    - 1;
                let b = groups
                    .get(2)
                    .ok_or("missing field".to_string())
                    .and_then(|n| n.parse::<usize>().map_err(|e| e.to_string()))?
                    - 1;
                let c = groups
                    .get(3)
                    .ok_or("missing field".to_string())
                    .and_then(|n| n.parse::<usize>().map_err(|e| e.to_string()))?
                    - 1;

                edges.push(Simplex {
                    id: vertices.len(),
                    coords: None,
                    boundary: vec![a, b, c], // NOTE: we insert vertex indices here, and fix them up later.
                });
            }
        }

        // Replace vertex indices with the correct edge indices.
        // If the edge does not exist, create it.
        for tri in triangles.iter_mut() {
            for i in 0..3 {
                let a = tri.boundary[i];
                let b = tri.boundary[(i + 1) % 3];
                let (a, b) = (a.min(b), a.max(b));
                let id = edge_map
                    .entry((a, b))
                    .or_insert_with(|| {
                        let id = edges.len();
                        edges.push(Simplex {
                            id,
                            coords: None,
                            boundary: vec![a, b],
                        });
                        id
                    })
                    .clone();
                tri.boundary[i] = id;
            }
        }

        Ok(Self {
            simplices_per_dim: vec![vertices, edges, triangles],
            coboundary_map: Vec::new(),
        })
    }
}
