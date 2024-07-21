use serde::{Deserialize, Serialize, Serializer};
use wasm_bindgen::prelude::*;

use crate::{
    complex::Complex,
    grid::{Grid, Index},
    reduce_from_scratch,
    sneaky_matrix::CI,
    stats::StackMem,
    Reduction, Swaps,
};
use log::{info, warn};

use std::{collections::HashMap, panic, sync::Mutex};

use std::alloc::{GlobalAlloc, Layout, System};
use std::sync::atomic::{AtomicIsize, Ordering};

struct CountingAllocator<A> {
    inner: A,
    allocated_now: AtomicIsize,
}

impl<A> CountingAllocator<A> {
    const fn new(inner: A) -> Self {
        Self {
            inner,
            allocated_now: AtomicIsize::new(0),
        }
    }

    fn allocated_now(&self) -> usize {
        self.allocated_now
            .load(Ordering::Relaxed)
            .try_into()
            .unwrap_or(0)
    }
}

unsafe impl<A: GlobalAlloc> GlobalAlloc for CountingAllocator<A> {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        self.allocated_now
            .fetch_add(layout.size() as isize, Ordering::Relaxed);
        self.inner.alloc(layout)
    }

    unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) {
        self.allocated_now
            .fetch_sub(layout.size() as isize, Ordering::Relaxed);
        self.inner.dealloc(ptr, layout);
    }

    unsafe fn alloc_zeroed(&self, layout: Layout) -> *mut u8 {
        self.allocated_now
            .fetch_add(layout.size() as isize, Ordering::Relaxed);
        self.inner.alloc_zeroed(layout)
    }

    unsafe fn realloc(&self, ptr: *mut u8, layout: Layout, new_size: usize) -> *mut u8 {
        self.allocated_now.fetch_add(
            new_size as isize - layout.size() as isize,
            Ordering::Relaxed,
        );
        self.inner.realloc(ptr, layout, new_size)
    }
}

#[global_allocator]
static ALLOCATOR: CountingAllocator<System> = CountingAllocator::new(System);

fn info_mem(label: &str) {
    let bytes = ALLOCATOR.allocated_now();
    info!(
        "🐊 {}: {} / {} kB / {} MB / {}% 🐊  ",
        label,
        bytes,
        bytes / 1024,
        bytes / 1024 / 1024,
        100.0 * (bytes / 1024 / 1024) as f64 / 4096.0,
    );
}

/// Global state.
static STATE: Mutex<Option<State>> = Mutex::new(None);

/// Initializes logging and panic hooks for debugging.
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
    info!("initialized logging in wasm worker");
}

#[derive(Serialize, Deserialize)]
struct State {
    grid: Grid,
    complex: Complex,
    grid_index_to_reduction: HashMap<Index, Reduction>,

    swaps0: Vec<(Index, Index, Swaps)>,
    swaps1: Vec<(Index, Index, Swaps)>,
    swaps2: Vec<(Index, Index, Swaps)>,
}

#[wasm_bindgen]
pub fn reset_state() -> Result<(), JsValue> {
    let mut guard = STATE.lock().map_err(|_| "STATE.lock failed")?;
    *guard = None;
    Ok(())
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

/// Create a new empty state.  Needs to be called before a bunch of the other functions.
#[wasm_bindgen]
pub fn create_empty_state(grid: JsValue, complex: JsValue) -> Result<(), JsValue> {
    let complex: Complex = serde_wasm_bindgen::from_value(complex)?;
    let grid: Grid = serde_wasm_bindgen::from_value(grid)?;
    let mut guard = STATE.lock().map_err(|_| "STATE.lock failed")?;
    *guard = Some(State {
        grid,
        complex,
        grid_index_to_reduction: HashMap::new(),
        swaps0: Vec::new(),
        swaps1: Vec::new(),
        swaps2: Vec::new(),
    });
    Ok(())
}

/// Loads the state from a serialized byte buffer.
#[wasm_bindgen]
pub fn load_state(
    bytes: JsValue,
    grid_offset: JsValue,
    _: js_sys::Function,
) -> Result<JsValue, JsValue> {
    let offset: Index = serde_wasm_bindgen::from_value(grid_offset)?;
    info_mem("load-state");
    let mut state: State = {
        let bytes: serde_bytes::ByteBuf = serde_wasm_bindgen::from_value(bytes)?;
        info_mem("after ByteBuf");
        info!(
            "load_state: bytes is {:.3} MB",
            (bytes.len() as f64) / 1024.0 / 1024.0
        );
        rmp_serde::from_slice(&bytes).map_err(|e| e.to_string())?
    };
    info_mem("after RMP");

    {
        let out: StackMem = state
            .grid_index_to_reduction
            .values()
            .flat_map(|r| &r.stacks)
            .map(|s| {
                let sm: StackMem = s.into();
                sm
            })
            .sum();
        info!("{:#?}", out);
        let total_mem: usize = state
            .grid_index_to_reduction
            .values()
            .flat_map(|r| &r.stacks)
            .map(|s| s.mem_usage())
            .sum();
        info!("total: {}", total_mem)
    }

    info!("Collect all swaps");
    let grid_index_to_reduction = state
        .grid_index_to_reduction
        .drain()
        .map(|(k, v)| (k + offset, v))
        .collect::<HashMap<_, _>>();
    info_mem("after red drain");
    info!("reductions: {}", grid_index_to_reduction.len());

    let swaps0: Vec<_> = state
        .swaps0
        .drain(0..)
        .map(|s| (s.0 + offset, s.1 + offset, s.2))
        .collect();
    info_mem("after state0 drain");
    let swaps1: Vec<_> = state
        .swaps1
        .drain(0..)
        .map(|s| (s.0 + offset, s.1 + offset, s.2))
        .collect();
    info_mem("after state1 drain");
    let swaps2: Vec<_> = state
        .swaps2
        .drain(0..)
        .map(|s| (s.0 + offset, s.1 + offset, s.2))
        .collect();
    info_mem("after state2 drain");

    info!(
        "swaps: dim0={}  dim1={}  dim2={}",
        swaps0.len(),
        swaps1.len(),
        swaps2.len(),
    );

    info!("Extend worker state");
    let mut guard = STATE.lock().map_err(|_| "STATE.lock failed")?;
    let state = guard.as_mut().ok_or("No global state")?;
    state
        .grid_index_to_reduction
        .extend(grid_index_to_reduction);
    info_mem("after red extend");
    state.swaps0.extend(swaps0);
    info_mem("after state0 extend");
    state.swaps1.extend(swaps1);
    info_mem("after state1 extend");
    state.swaps2.extend(swaps2);
    info_mem("after state2 extend");

    info!("convert output value");
    let out = serde_wasm_bindgen::to_value("okay")?;
    info_mem("end");

    Ok(out)
}

/// Get the barcode for a single grid point from the precomputed state.
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

/// Get the barcode for a single grid point from the precomputed state.
#[wasm_bindgen]
pub fn get_filtration_values_for_point(grid_point: Vec<isize>) -> Result<JsValue, String> {
    let index = Index([grid_point[0], grid_point[1], grid_point[2]]);
    let guard = STATE.lock().map_err(|_| "STATE.lock failed")?;
    let state = guard.as_ref().ok_or("No global state")?;

    let reduction = state
        .grid_index_to_reduction
        .get(&index)
        .ok_or("Index not in map")?;

    let filtration_0 = (0..state.complex.simplices_per_dim[0].len() as CI)
        .map(|id| reduction.simplex_entering_value(&state.complex, 0, id))
        .collect::<Vec<_>>();
    let filtration_1 = (0..state.complex.simplices_per_dim[1].len() as CI)
        .map(|id| reduction.simplex_entering_value(&state.complex, 1, id))
        .collect::<Vec<_>>();
    let filtration_2 = (0..state.complex.simplices_per_dim[2].len() as CI)
        .map(|id| reduction.simplex_entering_value(&state.complex, 2, id))
        .collect::<Vec<_>>();

    let js: JsValue = serde_wasm_bindgen::to_value(&vec![filtration_0, filtration_1, filtration_2])
        .map_err(|e| e.to_string())?;
    Ok(js)
}

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
/// Read a compelx from a `String` consisting of an .obj file.
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
    Ok(serde_wasm_bindgen::to_value(&new_pruned)?)
}

#[wasm_bindgen]
pub fn split_grid(grid: JsValue) -> Result<JsValue, JsValue> {
    let grid: Grid = serde_wasm_bindgen::from_value(grid)?;

    let (a, b, b_offset) = grid.split_with_overlap();

    let (aa, ab, ab_offset) = a.split_with_overlap();
    let (ba, bb, bb_offset) = b.split_with_overlap();

    let grids = [
        (aa, Index([0; 3])),
        (ab, ab_offset),
        (ba, b_offset),
        (bb, b_offset + bb_offset),
    ];

    Ok(serde_wasm_bindgen::to_value(&grids)?)
}

#[derive(Deserialize)]
pub struct RunOptions {
    /// Require that the faustian swaps involve the first birth of a given
    /// dimension.
    require_hom_birth_to_be_first: bool,
}

#[wasm_bindgen]
pub fn run_without_prune(
    grid: JsValue,
    complex: JsValue,
    options: JsValue,
    on_message: js_sys::Function,
) -> Result<(), JsValue> {
    let send_message = |label: &str, i: usize, n: usize| {
        on_message.call3(
            &JsValue::NULL,
            &JsValue::from_str(label),
            &JsValue::from_f64(i as f64),
            &JsValue::from_f64(n as f64),
        )
    };

    let grid: Grid = serde_wasm_bindgen::from_value(grid)?;
    let complex: Complex = serde_wasm_bindgen::from_value(complex)?;
    let options: RunOptions = serde_wasm_bindgen::from_value(options)?;

    let p = grid.center(Index([0; 3]));

    send_message("Reduce from scratch", 0, 1).unwrap();
    let s0 = reduce_from_scratch(&complex, p, false);
    send_message("Run vineyards", 0, 1).unwrap();
    let mut results = grid.run_vineyards_in_grid(
        &complex,
        s0,
        options.require_hom_birth_to_be_first,
        |i, n| {
            if i & 15 == 0 {
                send_message("Vineyards", i, n).unwrap();
            }
        },
    );

    let _ = send_message("Bake data 🧑‍🍳", 0, 1);
    for reduction in results.0.values_mut() {
        for st in reduction.stacks.iter_mut() {
            st.D.bake_in_permutations();
            st.R.bake_in_permutations();
            st.U_t.bake_in_permutations();
        }
    }

    send_message("Move state to global", 0, 1).unwrap();
    let mut state = STATE.lock().unwrap();

    fn filter_dim(v: &[(Index, Index, Swaps)], dim: usize) -> Vec<(Index, Index, Swaps)> {
        v.iter()
            .flat_map(|(i, j, s)| {
                let v: Vec<_> = s.v.iter().filter(|s| s.dim == dim).cloned().collect();
                (0 < v.len()).then(|| (*i, *j, Swaps { v }))
            })
            .collect()
    }

    *state = Some(State {
        grid,
        complex,
        grid_index_to_reduction: results.0,
        swaps0: filter_dim(&results.1, 0),
        swaps1: filter_dim(&results.1, 1),
        swaps2: filter_dim(&results.1, 2),
    });

    Ok(())
}
