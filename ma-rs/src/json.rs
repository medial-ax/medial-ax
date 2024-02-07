#[cfg(feature = "python")]
use pyo3::pyfunction;
use serde::Serialize;

use crate::{
    complex::{Complex, Pos, Simplex},
    grid::{Grid, Index},
    permutation::Permutation,
    BirthDeathPair, Reduction, Swaps,
};

#[derive(Debug, Serialize)]
pub struct JsonOuput {
    pub vertices: Vec<Simplex>,
    pub edges: Vec<Simplex>,
    pub triangles: Vec<Simplex>,

    pub key_point: Pos,

    pub vertex_ordering: Permutation,
    pub edge_ordering: Permutation,
    pub triangle_ordering: Permutation,

    pub empty_barcode: Vec<BirthDeathPair>,
    pub vertex_barcode: Vec<BirthDeathPair>,
    pub edge_barcode: Vec<BirthDeathPair>,
    pub triangle_barcode: Vec<BirthDeathPair>,

    grid: Grid,
    swaps: Vec<(Index, Index, Swaps)>,
}

#[cfg_attr(feature = "python", pyfunction)]
pub fn json_output(
    complex: &Complex,
    reduction: &Reduction,
    grid: &Grid,
    swapssssss: Vec<(Index, Index, Swaps)>,
) -> String {
    let vertices = complex.simplices_per_dim[0].clone();
    let edges = complex.simplices_per_dim[1].clone();
    let triangles = complex.simplices_per_dim[2].clone();
    let key_point = reduction.key_point;
    let vertex_ordering = reduction.stacks[0].ordering.clone();
    let edge_ordering = reduction.stacks[1].ordering.clone();
    let triangle_ordering = reduction.stacks[2].ordering.clone();

    let empty_barcode = reduction.barcode(complex, -1);
    let vertex_barcode = reduction.barcode(complex, 0);
    let edge_barcode = reduction.barcode(complex, 1);
    let triangle_barcode = reduction.barcode(complex, 2);

    let json_output = JsonOuput {
        vertices,
        edges,
        triangles,
        key_point,
        vertex_ordering,
        edge_ordering,
        triangle_ordering,
        empty_barcode,
        vertex_barcode,
        edge_barcode,
        triangle_barcode,

        grid: grid.clone(),
        swaps: swapssssss.clone(),
    };

    serde_json::to_string(&json_output).unwrap()
}
