use crate::SneakyMatrix;

#[derive(Debug, Clone, Copy)]
pub struct Pos([f64; 3]);

#[derive(Debug, Clone)]
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
}
