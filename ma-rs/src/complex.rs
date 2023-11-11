use std::collections::HashMap;

use crate::SneakyMatrix;

#[derive(Clone, Copy)]
pub struct Pos([f64; 3]);

impl pyo3::IntoPy<pyo3::PyObject> for Pos {
    fn into_py(self, py: pyo3::Python<'_>) -> pyo3::PyObject {
        pyo3::types::PyList::new(py, &self.0).into()
    }
}

impl Pos {
    pub fn dist(&self, other: &Pos) -> f64 {
        let mut sum = 0.0;
        for i in 0..3 {
            sum += (self.0[i] - other.0[i]).powi(2);
        }
        sum.sqrt()
    }
}

impl std::fmt::Debug for Pos {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_fmt(format_args!(
            "[{}, {}, {}]",
            self.0[0], self.0[1], self.0[2]
        ))
    }
}

#[derive(Debug, Clone)]
#[pyo3::pyclass(get_all)]
pub struct Simplex {
    /// Unique identifier of the simplex.  This is only unique within the dimension for the complex it is in.
    pub id: isize,
    /// Coordinates of the simplex, if any.
    pub coords: Option<Pos>,
    /// The boundary of the simplex, i.e. the indices of the faces.
    pub boundary: Vec<isize>,
}

#[pyo3::pymethods]
impl Simplex {
    pub fn dim(&self) -> isize {
        self.boundary.len() as isize - 1
    }

    pub fn __repr__(&self) -> String {
        match self.dim() {
            -1 => "Ø".to_string(),
            0 => format!(
                "v({}; pos={}",
                self.id,
                self.coords
                    .map(|c| format!("{:?}", c))
                    .unwrap_or_else(|| format!("[no pos]"))
            ),
            1 => format!("e({}; bnd={:?})", self.id, self.boundary),
            2 => format!("f({}; bnd={:?})", self.id, self.boundary),
            _ => panic!(),
        }
    }
}

#[derive(Debug, Clone)]
#[pyo3::pyclass(get_all)]
pub struct Complex {
    pub simplices_per_dim: Vec<Vec<Simplex>>,

    pub coboundary_map: Vec<Vec<usize>>,
}

#[pyo3::pymethods]
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
                sm.set(*j as usize, s.id as usize, true);
            }
        }
        sm
    }
}

impl Complex {
    pub fn read_from_obj<P: AsRef<std::path::Path>>(p: P) -> Result<Self, String> {
        let input_str =
            std::fs::read_to_string(p).map_err(|e| format!("Error reading file: {}", e))?;

        let mut vertices: Vec<Simplex> = Vec::new();
        let mut edges: Vec<Simplex> = Vec::new();
        let mut triangles: Vec<Simplex> = Vec::new();

        // Map (i, j) to edge simplex index.
        let mut edge_map = HashMap::<(isize, isize), isize>::new();

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
                    id: vertices.len() as isize,
                    coords: Some(coords),
                    boundary: vec![-1],
                });
            } else if line.starts_with("l") {
                // l 1 2
                let groups = line.split_ascii_whitespace().collect::<Vec<_>>();
                let a = groups
                    .get(1)
                    .ok_or("missing field".to_string())
                    .and_then(|n| n.parse::<isize>().map_err(|e| e.to_string()))?
                    - 1; // NOTE: .obj is 1-indexed

                let b = groups
                    .get(2)
                    .ok_or("missing field".to_string())
                    .and_then(|n| n.parse::<isize>().map_err(|e| e.to_string()))?
                    - 1; // NOTE: .obj is 1-indexed

                let id = edges.len() as isize;

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
                    .and_then(|n| n.parse::<isize>().map_err(|e| e.to_string()))?
                    - 1;
                let b = groups
                    .get(2)
                    .ok_or("missing field".to_string())
                    .and_then(|n| n.parse::<isize>().map_err(|e| e.to_string()))?
                    - 1;
                let c = groups
                    .get(3)
                    .ok_or("missing field".to_string())
                    .and_then(|n| n.parse::<isize>().map_err(|e| e.to_string()))?
                    - 1;

                triangles.push(Simplex {
                    id: triangles.len() as isize,
                    coords: None,
                    boundary: vec![a, b, c], // NOTE: we insert vertex indices here, and fix them up later.
                });
            }
        }

        // Replace vertex indices with the correct edge indices.
        // If the edge does not exist, create it.
        for tri in triangles.iter_mut() {
            let bnd = tri.boundary.clone();
            for i in 0..3 {
                let a = bnd[i];
                let b = bnd[(i + 1) % 3];
                let (a, b) = (a.min(b), a.max(b));
                let id = edge_map
                    .entry((a, b))
                    .or_insert_with(|| {
                        let id = edges.len() as isize;
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn read_obj() {
        let path = "../input/cube-subdiv-1.obj";
        let c = Complex::read_from_obj(path).unwrap();

        let num_verts = c.num_simplices_of_dim(0) as isize;
        for e in &c.simplices_per_dim[1] {
            for &vi in &e.boundary {
                assert!(0 <= vi);
                assert!(vi < num_verts);
            }
        }

        let num_edges = c.num_simplices_of_dim(1) as isize;
        for t in &c.simplices_per_dim[2] {
            for &vi in &t.boundary {
                assert!(0 <= vi);
                assert!(vi < num_edges);
            }
        }
    }
}
