use serde::Deserialize;
use wasm_bindgen::prelude::*;

use crate::{
    complex::Complex,
    grid::{Grid, Index},
    reduce_from_scratch, Swap, Swaps,
};
use log::{debug, warn};

use std::{collections::HashMap, panic};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PruningParam {
    euclidean: bool,
    euclidean_distance: Option<f64>,
    coface: bool,
    face: bool,
    persistence: bool,
    persistence_threshold: Option<f64>,
}

#[wasm_bindgen]
pub fn my_init_function() {
    static mut WAS_INIT: bool = false;
    panic::set_hook(Box::new(console_error_panic_hook::hook));
    unsafe {
        if !WAS_INIT {
            let _ = console_log::init_with_level(log::Level::Debug);
            WAS_INIT = true;
        }
    }
    debug!("WASM initialized");
}

#[wasm_bindgen]
pub fn make_complex_from_obj(obj_body: String) -> Result<JsValue, JsValue> {
    let complex = Complex::read_from_obj_string(&obj_body)?;
    serde_wasm_bindgen::to_value(&complex).map_err(|e| JsValue::from_str(&format!("{}", e)))
}

#[wasm_bindgen]
pub fn run(
    grid: JsValue,
    complex: JsValue,
    params: JsValue,
    on_message: js_sys::Function,
) -> Result<JsValue, JsValue> {
    let send_message = |label: &str, i: usize, n: usize| {
        on_message.call3(
            &JsValue::NULL,
            &JsValue::from_str(label),
            &JsValue::from_f64(i as f64),
            &JsValue::from_f64(n as f64),
        )
    };

    let params: HashMap<String, PruningParam> = serde_wasm_bindgen::from_value(params)?;
    let grid: Grid = serde_wasm_bindgen::from_value(grid)?;

    let complex: Complex = serde_wasm_bindgen::from_value(complex)?;

    let p = grid.center(Index([0; 3]));

    send_message("Reduce from scratch", 0, 0).unwrap();
    let s0 = reduce_from_scratch(&complex, p, false);
    send_message("Run vineyards", 0, 0).unwrap();
    let results = grid.run_vineyards_in_grid(&complex, s0, |i, n| {
        if i & 15 == 0 {
            send_message("Vineyards", i, n).unwrap();
        }
    });
    let reduction_map = results.0;
    let swaps_per_grid_pair = results.1;

    let mut grid_swaps_vec: Vec<(Index, Index, Swaps)> = Vec::new();
    let prune_iters = swaps_per_grid_pair.len();
    for (i, s) in swaps_per_grid_pair.into_iter().enumerate() {
        if i & 15 == 0 {
            send_message("Prune", i, prune_iters).unwrap();
        }
        let swaps = s.2;

        let mut swaps_between_these_grid_cells: Vec<Swap> = Vec::new();
        for dim in 0..3 {
            let mut dim_swaps = Swaps {
                v: swaps.v.iter().cloned().filter(|s| s.dim == dim).collect(),
            };
            let params = match params.get(&format!("{}", dim)) {
                Some(p) => p,
                None => {
                    panic!("Not sure what to do here yet.");
                }
            };

            if params.euclidean {
                if let Some(dist) = params.euclidean_distance {
                    dim_swaps.prune_euclidian(&complex, dist)
                } else {
                    warn!(
                        "params dim {}: euclidean was true but distance was None",
                        dim
                    );
                }
            }

            if params.face {
                dim_swaps.prune_common_face(&complex);
            }

            if params.coface {
                dim_swaps.prune_coboundary(&complex);
            }

            if params.persistence {
                if let Some(dist) = params.persistence_threshold {
                    let grid_index_a = s.0;
                    let reduction_at_a = reduction_map.get(&grid_index_a).unwrap();
                    let grid_index_b = s.1;
                    let reduction_at_b = reduction_map.get(&grid_index_b).unwrap();
                    dim_swaps.prune_persistence(&complex, reduction_at_a, reduction_at_b, dist)
                } else {
                    warn!(
                        "params dim {}: persistence was true but threshold was None",
                        dim
                    );
                }
            }
            swaps_between_these_grid_cells.extend(dim_swaps.v);
        }
        grid_swaps_vec.push((
            s.0,
            s.1,
            Swaps {
                v: swaps_between_these_grid_cells,
            },
        ));
    }

    Ok(serde_wasm_bindgen::to_value(&grid_swaps_vec)?)
}
