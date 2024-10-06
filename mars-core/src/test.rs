use std::path::PathBuf;

use crate::*;

/// Construct a test [Complex]  of the cube.
pub fn test_complex_cube() -> Complex {
    let mut d = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    d.push("test/cube.obj");
    Complex::read_from_obj_path(&d).expect("Failed to read test input")
}

pub fn test_grid_for_cube() -> grid::VineyardsGrid {
    grid::VineyardsGrid {
        corner: Pos([-0.5, -0.5, -0.5]),
        size: 0.4,
        shape: grid::Index([5, 5, 5]),
        r#type: "grd".to_string(),
    }
}

pub fn default_pruning_param_dim0() -> PruningParam {
    PruningParam {
        euclidean: true,
        euclidean_distance: Some(0.01),
        coface: true,
        face: false,
        persistence: false,
        persistence_threshold: None,
    }
}

pub fn default_pruning_param_dim1() -> PruningParam {
    PruningParam {
        euclidean: true,
        euclidean_distance: Some(0.01),
        coface: false,
        face: true,
        persistence: true,
        persistence_threshold: Some(0.01),
    }
}

pub fn default_pruning_param_dim2() -> PruningParam {
    PruningParam {
        euclidean: true,
        euclidean_distance: Some(0.01),
        coface: false,
        face: true,
        persistence: false,
        persistence_threshold: None,
    }
}
