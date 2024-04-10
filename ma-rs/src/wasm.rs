use serde::{Deserialize, Deserializer, Serialize, Serializer};
use wasm_bindgen::prelude::*;

use crate::{
    complex::Complex,
    grid::{Grid, Index},
    reduce_from_scratch, Reduction, Swaps,
};
use log::{info, warn};

use std::{collections::HashMap, panic, sync::Mutex};

#[derive(Serialize, Deserialize)]
struct State {
    grid: Grid,
    complex: Complex,
    p0: Index,
    grid_index_to_reduction: HashMap<Index, Reduction>,

    swaps0: Vec<(Index, Index, Swaps)>,
    swaps1: Vec<(Index, Index, Swaps)>,
    swaps2: Vec<(Index, Index, Swaps)>,

    swaps0_pruned: Vec<(Index, Index, Swaps)>,
    swaps1_pruned: Vec<(Index, Index, Swaps)>,
    swaps2_pruned: Vec<(Index, Index, Swaps)>,
}

#[wasm_bindgen]
pub fn get_state() -> Result<JsValue, JsValue> {
    let guard = STATE.lock().map_err(|_| "STATE.lock failed")?;
    let state = guard.as_ref().ok_or("No global state")?;
    let bytes = rmp_serde::to_vec(&state).map_err(|e| e.to_string())?;
    let serializer = serde_wasm_bindgen::Serializer::new();
    let ret = serializer.serialize_bytes(&bytes)?;
    Ok(ret)
}

#[wasm_bindgen]
pub fn load_state(bytes: JsValue, on_message: js_sys::Function) -> Result<JsValue, JsValue> {
    let send_message = |label: &str| on_message.call1(&JsValue::NULL, &JsValue::from_str(label));

    send_message("1").unwrap();
    let bytes: serde_bytes::ByteBuf = serde_wasm_bindgen::from_value(bytes)?;
    send_message("2").unwrap();
    let state: State = rmp_serde::from_slice(&bytes).map_err(|e| e.to_string())?;
    send_message("3").unwrap();
    info!("{:?}", state.grid);
    Ok(serde_wasm_bindgen::to_value("okay")?)
}

#[wasm_bindgen]
pub fn get_barcode_for_point(grid_point: Vec<isize>) -> Result<JsValue, String> {
    let index = Index([grid_point[0], grid_point[1], grid_point[2]]);
    let guard = STATE.lock().map_err(|_| "STATE.lock failed")?;
    let state = guard.as_ref().ok_or("No global state")?;

    let reduction = state
        .grid_index_to_reduction
        .get(&index)
        .ok_or("Index not in map")?;

    let swaps_1 = reduction.barcode(&state.complex, -1);
    let swaps0 = reduction.barcode(&state.complex, 0);
    let swaps1 = reduction.barcode(&state.complex, 1);
    let swaps2 = reduction.barcode(&state.complex, 2);

    let js: JsValue = serde_wasm_bindgen::to_value(&vec![swaps_1, swaps0, swaps1, swaps2])
        .map_err(|e| e.to_string())?;
    Ok(js)
}

static STATE: Mutex<Option<State>> = Mutex::new(None);

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
}

#[wasm_bindgen]
pub fn make_complex_from_obj(obj_body: String) -> Result<JsValue, JsValue> {
    let complex = Complex::read_from_obj_string(&obj_body)?;
    serde_wasm_bindgen::to_value(&complex).map_err(|e| JsValue::from_str(&format!("{}", e)))
}

fn prune<F: FnMut(&str, usize, usize) -> Result<JsValue, JsValue>>(
    st: &State,
    params: &PruningParam,
    dim: usize,
    mut send_message: F,
) -> Vec<(Index, Index, Swaps)> {
    let reduction_map = &st.grid_index_to_reduction;
    let swaps_per_grid_pair = match dim {
        0 => &st.swaps0,
        1 => &st.swaps1,
        2 => &st.swaps2,
        _ => panic!("wat"),
    };
    let complex = &st.complex;

    let mut grid_swaps_vec: Vec<(Index, Index, Swaps)> = Vec::new();
    let prune_iters = swaps_per_grid_pair.len();

    for (i, s) in swaps_per_grid_pair.into_iter().enumerate() {
        if i & 127 == 0 {
            send_message("Prune", i, prune_iters).unwrap();
        }
        if s.2.v.len() == 0 {
            continue;
        }

        let mut dim_swaps = s.2.clone();

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

        grid_swaps_vec.push((s.0, s.1, dim_swaps));
    }

    grid_swaps_vec
}

#[wasm_bindgen]
pub fn prune_dimension(
    dim: JsValue,
    params: JsValue,
    on_message: js_sys::Function,
) -> Result<JsValue, JsValue> {
    let dim: usize = serde_wasm_bindgen::from_value(dim)?;
    let send_message = |label: &str, i: usize, n: usize| {
        on_message.call3(
            &JsValue::NULL,
            &JsValue::from_str(label),
            &JsValue::from_f64(i as f64),
            &JsValue::from_f64(n as f64),
        )
    };

    let params: PruningParam = serde_wasm_bindgen::from_value(params)?;
    let mut state = STATE.lock().unwrap();
    let st = state.as_mut().unwrap();
    let new_pruned = prune(st, &params, dim, send_message);

    match dim {
        0 => st.swaps0_pruned = new_pruned.clone(),
        1 => st.swaps1_pruned = new_pruned.clone(),
        2 => st.swaps2_pruned = new_pruned.clone(),
        _ => return Err("bad dimension".into()),
    }

    Ok(serde_wasm_bindgen::to_value(&new_pruned)?)
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

    send_message("Move state to global", 0, 1).unwrap();
    let mut state = STATE.lock().unwrap();

    fn filter_dim(v: &[(Index, Index, Swaps)], dim: usize) -> Vec<(Index, Index, Swaps)> {
        v.iter()
            .map(|(i, j, s)| {
                (
                    *i,
                    *j,
                    Swaps {
                        v: s.v.iter().filter(|s| s.dim == dim).cloned().collect(),
                    },
                )
            })
            .collect()
    }

    *state = Some(State {
        grid,
        complex,
        p0: Index([0; 3]),
        grid_index_to_reduction: results.0,
        swaps0: filter_dim(&results.1, 0),
        swaps1: filter_dim(&results.1, 1),
        swaps2: filter_dim(&results.1, 2),
        swaps0_pruned: Vec::new(),
        swaps1_pruned: Vec::new(),
        swaps2_pruned: Vec::new(),
    });
    let st = state.as_mut().unwrap();

    st.swaps0_pruned = prune(&st, &params.get("0").unwrap(), 0, send_message);
    st.swaps1_pruned = prune(&st, &params.get("1").unwrap(), 1, send_message);
    st.swaps2_pruned = prune(&st, &params.get("2").unwrap(), 2, send_message);

    #[derive(Serialize)]
    struct Ret<'a> {
        dim0: &'a Vec<(Index, Index, Swaps)>,
        dim1: &'a Vec<(Index, Index, Swaps)>,
        dim2: &'a Vec<(Index, Index, Swaps)>,
    }

    Ok(serde_wasm_bindgen::to_value(&Ret {
        dim0: &st.swaps0_pruned,
        dim1: &st.swaps1_pruned,
        dim2: &st.swaps2_pruned,
    })?)
}
