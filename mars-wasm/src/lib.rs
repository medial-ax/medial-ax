use anyhow::{bail, Result};
use serde::{Deserialize, Serialize, Serializer};
use wasm_bindgen::prelude::*;

use log::{debug, info, warn};
use mars_core::{
    complex::{Complex, Pos},
    grid::{Index, VineyardsGrid, VineyardsGridMesh},
    reduce_from_scratch,
    sneaky_matrix::CI,
    stats::StackMem,
    PruningParam, Reduction, Swaps,
};

use std::{
    collections::{HashMap, HashSet},
    panic,
    sync::Mutex,
};

use std::alloc::{GlobalAlloc, Layout, System};
use std::sync::atomic::{AtomicIsize, Ordering};

/// Global allocator that counts the number of outstanding allocated bytes.
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

/// Print memory usage info with a label.
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
// static STATE: Mutex<Option<State>> = Mutex::new(None);

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
    info!("info: my_init_function");
}

/// Turns a [usize] in bytes into a [f64] in MB.
fn mb(u: usize) -> f64 {
    (u as f64) / 1024.0 / 1024.0
}

#[wasm_bindgen(skip_typescript)]
#[derive(Default)]
pub struct Api {
    core: mars_core::Mars,
    vineyards: Option<mars_core::Vineyards>,
    pruned_swaps: [Option<(PruningParam, mars_core::SwapList)>; 3],

    // Callbacks
    on_complex_change: Option<js_sys::Function>,
    on_grid_change: Option<js_sys::Function>,
    on_vineyards_change: Option<js_sys::Function>,
}

impl Api {
    fn notify_complex_change(&self) {
        if let Some(ref f) = self.on_complex_change {
            let _ = f.call0(&JsValue::null());
        }
    }

    fn notify_grid_change(&self) {
        if let Some(ref f) = self.on_grid_change {
            let _ = f.call0(&JsValue::null());
        }
    }

    fn notify_vineyards_change(&self) {
        if let Some(ref f) = self.on_vineyards_change {
            let _ = f.call0(&JsValue::null());
        }
    }
}

#[wasm_bindgen]
impl Api {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Api {
        Default::default()
    }

    pub fn load_complex(&mut self, obj_str: String) -> Result<(), String> {
        self.core.load_from_obj_str(&obj_str)?;
        self.notify_complex_change();
        Ok(())
    }

    pub fn set_on_complex_change(&mut self, f: js_sys::Function) {
        if self.on_complex_change.is_some() {
            warn!("If we hit this we probably want a list instead of a single function.");
        }
        self.on_complex_change = Some(f);
    }

    pub fn set_on_grid_change(&mut self, f: js_sys::Function) {
        if self.on_grid_change.is_some() {
            warn!("If we hit this we probably want a list instead of a single function.");
        }
        self.on_grid_change = Some(f);
    }

    pub fn set_on_vineyards_change(&mut self, f: js_sys::Function) {
        if self.on_vineyards_change.is_some() {
            warn!("If we hit this we probably want a list instead of a single function.");
        }
        self.on_vineyards_change = Some(f);
    }

    pub fn load_mesh_grid(&mut self, obj_str: String) -> Result<(), String> {
        self.core.load_meshgrid_from_obj_str(&obj_str)?;
        self.notify_grid_change();
        Ok(())
    }

    #[wasm_bindgen(getter)]
    pub fn complex(&self) -> Result<JsValue, String> {
        let Some(ref c) = self.core.complex else {
            return Ok(JsValue::undefined());
        };
        serde_wasm_bindgen::to_value(&c).map_err(|e| e.to_string())
    }

    #[wasm_bindgen(getter)]
    pub fn grid(&self) -> Result<JsValue, String> {
        let Some(ref g) = self.core.grid else {
            return Ok(JsValue::undefined());
        };

        match g {
            mars_core::Grid::Regular(g) => serde_wasm_bindgen::to_value(&g),
            mars_core::Grid::Mesh(g) => serde_wasm_bindgen::to_value(&g),
        }
        .map_err(|e| e.to_string())
    }

    #[wasm_bindgen(setter)]
    pub fn set_grid(&mut self, grid: JsValue) -> Result<(), String> {
        let grid: VineyardsGrid =
            serde_wasm_bindgen::from_value(grid).map_err(|e| e.to_string())?;
        self.core.grid = Some(mars_core::Grid::Regular(grid));
        self.notify_grid_change();
        Ok(())
    }

    /// Flattened coordinates for every face of the complex, GL style.
    pub fn face_positions(&self) -> Result<Vec<f64>, String> {
        info!("Api.face_positions");
        let mut ret = Vec::new();
        let Some(ref c) = self.core.complex else {
            return Ok(vec![]);
        };
        for asd in &c.simplices_per_dim[2] {
            let e0 = asd.boundary[0] as usize;
            let e1 = asd.boundary[1] as usize;
            let e2 = asd.boundary[2] as usize;

            let mut vs = [
                c.simplices_per_dim[1][e0].boundary[0],
                c.simplices_per_dim[1][e0].boundary[1],
                c.simplices_per_dim[1][e1].boundary[0],
                c.simplices_per_dim[1][e1].boundary[1],
                c.simplices_per_dim[1][e2].boundary[0],
                c.simplices_per_dim[1][e2].boundary[1],
            ];
            vs.sort();

            let v0 = vs[0] as usize; // Every vert in included twice
            ret.extend_from_slice(&c.simplices_per_dim[0][v0].coords.unwrap().0);
            let v1 = vs[2] as usize;
            ret.extend_from_slice(&c.simplices_per_dim[0][v1].coords.unwrap().0);
            let v2 = vs[4] as usize;
            ret.extend_from_slice(&c.simplices_per_dim[0][v2].coords.unwrap().0);
        }

        Ok(ret)
    }

    /// Flattened coordinates for every face of the computed medial axes, GL style.
    pub fn medial_axes_face_positions(&self, dim: usize) -> Result<Vec<f32>, String> {
        let mut out: Vec<f64> = Vec::new();
        let Some(ref g) = self.core.grid else {
            return Ok(Vec::new());
        };
        let Some(ref v) = self.vineyards else {
            return Ok(Vec::new());
        };

        let swaps = self.pruned_swaps[dim].as_ref().map(|(_, s)| s);
        let swaps = swaps.unwrap_or(&v.swaps[dim]);

        match g {
            mars_core::Grid::Regular(grid) => {
                for s in swaps {
                    if 0 < s.2.v.len() {
                        let [a, b, c, d] = grid.dual_quad_points(s.0, s.1);
                        for p in &[a, b, c, a, c, d] {
                            out.extend_from_slice(&[p.x(), p.y(), p.z()]);
                        }
                    }
                }
            }
            mars_core::Grid::Mesh(grid) => {
                for s in swaps {
                    if 0 < s.2.v.len() {
                        let [a, b, c, d] = grid.dual_quad_points(s.0, s.1);
                        for p in &[a, b, c, a, c, d] {
                            out.extend_from_slice(&[p.x(), p.y(), p.z()]);
                        }
                    }
                }
            }
        }

        Ok(out.into_iter().map(|n| n as f32).collect())
    }

    pub fn subproblems(&self) -> Result<Vec<JsValue>, JsValue> {
        let subs = self.core.split_into_4()?;

        let mut buffers = Vec::new();

        for i in 0..4 {
            let bytes = rmp_serde::to_vec(&subs[i]).map_err(|e| e.to_string())?;
            info!("serialize_core: {:.2} MB", mb(bytes.len()));
            let serializer = serde_wasm_bindgen::Serializer::new();
            let ret = serializer.serialize_bytes(&bytes)?;
            buffers.push(ret);
        }

        Ok(buffers)
    }

    pub fn serialize_core(&self) -> Result<JsValue, JsValue> {
        let bytes = rmp_serde::to_vec(&self.core).map_err(|e| e.to_string())?;
        info!("serialize_core: {:.2} MB", mb(bytes.len()));
        let serializer = serde_wasm_bindgen::Serializer::new();
        let ret = serializer.serialize_bytes(&bytes)?;
        Ok(ret)
    }

    pub fn deserialize_core(&mut self, value: JsValue) -> Result<(), JsValue> {
        let bytes: serde_bytes::ByteBuf = serde_wasm_bindgen::from_value(value)?;
        let core: mars_core::Mars = rmp_serde::from_slice(&bytes)
            .map_err(|e| format!("rmp_serde failed: {}", e.to_string()))?;
        info!("deserialize_core: {:.2} MB", mb(bytes.len()));
        self.core = core;
        self.notify_complex_change();
        self.notify_grid_change();
        Ok(())
    }

    pub fn serialize_vineyards(&self) -> Result<JsValue, JsValue> {
        let Some(ref vineyards) = self.vineyards else {
            info!("serialize_vineyards: no vineyards");
            return Ok(JsValue::undefined());
        };
        let bytes = rmp_serde::to_vec(vineyards).map_err(|e| e.to_string())?;
        info!("serialize_vineyards: {:.2} MB", mb(bytes.len()));
        let serializer = serde_wasm_bindgen::Serializer::new();
        let ret = serializer.serialize_bytes(&bytes)?;
        Ok(ret)
    }

    pub fn deserialize_vineyards(&mut self, value: JsValue) -> Result<(), JsValue> {
        let bytes: serde_bytes::ByteBuf = serde_wasm_bindgen::from_value(value)?;
        let vineyards: mars_core::Vineyards = rmp_serde::from_slice(&bytes)
            .map_err(|e| format!("rmp_serde failed: {}", e.to_string()))?;
        info!("deserialize_vineyards: {:.2} MB", mb(bytes.len()));
        self.vineyards = Some(vineyards);
        self.notify_vineyards_change();
        Ok(())
    }

    /// Run vineyards.
    pub fn run_vineyards(
        &mut self,
        on_progress: Option<js_sys::Function>,
    ) -> Result<JsValue, JsValue> {
        debug!("run_vineyards");
        let progress = |i: usize, n: usize| {
            if i % 15 == 0 {
                if let Some(ref f) = on_progress {
                    let _ = f.call3(
                        &JsValue::NULL,
                        &JsValue::from_str("Vineyards"),
                        &JsValue::from_f64(i as f64),
                        &JsValue::from_f64(n as f64),
                    );
                }
            }
        };

        let v = self.core.run(progress)?;
        self.vineyards = Some(v);
        self.notify_vineyards_change();

        debug!("run_vineyards: end");
        Ok(JsValue::from_str("ok"))
    }

    pub fn prune(
        &mut self,
        dim: usize,
        params: JsValue,
        on_progress: Option<js_sys::Function>,
    ) -> Result<(), JsValue> {
        let params: PruningParam = serde_wasm_bindgen::from_value(params)?;

        let Some(ref c) = self.core.complex else {
            return Err("Need a complex before pruning.".to_string())?;
        };

        let Some(ref mut v) = self.vineyards else {
            return Err("Need to compute vineyards before pruning.".to_string())?;
        };

        let pruned = v.prune_dim(dim, &params, c, |i, n| {
            if i % 127 == 0 {
                if let Some(ref f) = on_progress {
                    let _ = f.call3(
                        &JsValue::NULL,
                        &JsValue::from_str("Pruning"),
                        &JsValue::from_f64(i as f64),
                        &JsValue::from_f64(n as f64),
                    );
                }
            }
        });

        self.pruned_swaps[dim] = Some((params, pruned));
        Ok(())
    }
}

#[wasm_bindgen(typescript_custom_section)]
const _0: &'static str = r#"
/** Returns a serialized Vineyards. */
run_sub_mars(submars: Uint8Array): Uint8Array;
"#;
pub fn run_sub_mars(
    submars: JsValue,
    on_progress: Option<js_sys::Function>,
) -> Result<JsValue, JsValue> {
    let bytes: serde_bytes::ByteBuf = serde_wasm_bindgen::from_value(submars)?;
    let submars: mars_core::SubMars = rmp_serde::from_slice(&bytes)
        .map_err(|e| format!("rmp_serde failed: {}", e.to_string()))?;

    let progress = |i: usize, n: usize| {
        if i % 15 == 0 {
            if let Some(ref f) = on_progress {
                let _ = f.call3(
                    &JsValue::NULL,
                    &JsValue::from_str("Vineyards"),
                    &JsValue::from_f64(i as f64),
                    &JsValue::from_f64(n as f64),
                );
            }
        }
    };

    let vineyards = submars.run(progress)?;

    let bytes = rmp_serde::to_vec(&vineyards).map_err(|e| e.to_string())?;
    info!("run_sub_mars: {:.2} MB", mb(bytes.len()));
    let serializer = serde_wasm_bindgen::Serializer::new();
    let ret = serializer.serialize_bytes(&bytes)?;
    Ok(ret)
}

#[wasm_bindgen(typescript_custom_section)]
const _1: &'static str = r#"

export type Point = [number, number, number];
export type Index = [number, number, number];

export type VineyardsGrid = {
    corner: Point,
    size: number,
    shape: Point,
    type: "grid",
}

export type VineyardsGridMesh = {
    points: Point[],
    neighbors: Map<number, number[]>,
    type: "meshgrid",
}

export class Api {
  free(): void;
  constructor();

  set_on_complex_change(f: () => void): void;
  set_on_grid_change(f: () => void): void;
  set_on_vineyards_change(f: () => void): void;

  load_complex(obj: string): void;
  load_mesh_grid(obj: string): void;
  set_grid(grid: VineyardsGrid): void;

  split_grid(): [VineyardsGrid, Index][] | [VineyardsGridMesh, Index][];

  get complex(): any;

  set grid(g: VineyardsGrid | VineyardsGridMesh): void;
  get grid(): VineyardsGrid | VineyardsGridMesh;

  run_vineyards(progress?: (label: string, i: number, n: number) => void): void;

  prune(dim: number, params: PruningParam, progress?: (label: string, i: number, n: number) => void);

  face_positions(): number[];
  medial_axes_face_positions(dim: number): Float32Array;

  subproblems(): [Uint8Array, Uint8Array, Uint8Array, Uint8Array];

  serialize_core(): Uint8Array;
  deserialize_core(c: Uint8Array): void;

  serialize_vineyards(): Uint8Array;
  deserialize_vineyards(c: Uint8Array): void;
}
"#;

// #[derive(Serialize, Deserialize)]
// pub struct State {
//     ///
//     pub grid: Option<VineyardsGrid>,
//     pub mesh_grid: Option<VineyardsGridMesh>,
//
//     pub complex: Complex,
//     pub grid_index_to_reduction: HashMap<Index, Reduction>,
//
//     pub swaps0: Vec<(Index, Index, Swaps)>,
//     pub swaps1: Vec<(Index, Index, Swaps)>,
//     pub swaps2: Vec<(Index, Index, Swaps)>,
// }
//
// /// Set state to [None]
// #[wasm_bindgen]
// pub fn reset_state() -> Result<(), JsValue> {
//     let mut guard = STATE.lock().map_err(|_| "STATE.lock failed")?;
//     *guard = None;
//     Ok(())
// }
//
// /// Serialize state and return it as a [JsValue].
// #[wasm_bindgen]
// pub fn get_state() -> Result<JsValue, JsValue> {
//     let guard = STATE.lock().map_err(|_| "STATE.lock failed")?;
//     let state = guard.as_ref().ok_or("No global state")?;
//     let bytes = rmp_serde::to_vec(&state).map_err(|e| e.to_string())?;
//     let serializer = serde_wasm_bindgen::Serializer::new();
//     let ret = serializer.serialize_bytes(&bytes)?;
//     Ok(ret)
// }
//
// fn mesh_from_jsvalue(
//     value: JsValue,
// ) -> Result<(Option<VineyardsGrid>, Option<VineyardsGridMesh>), JsValue> {
//     if let Ok(grid) = serde_wasm_bindgen::from_value::<VineyardsGrid>(value.clone()) {
//         Ok((Some(grid), None))
//     } else {
//         let grid = serde_wasm_bindgen::from_value::<VineyardsGridMesh>(value)?;
//         Ok((None, Some(grid)))
//     }
// }
//
// /// Create a new empty state.  Needs to be called before a bunch of the other functions.
// #[wasm_bindgen]
// pub fn create_empty_state(grid: JsValue, complex: JsValue) -> Result<(), JsValue> {
//     let complex: Complex = serde_wasm_bindgen::from_value(complex)?;
//     let (grid, mesh_grid) = mesh_from_jsvalue(grid)?;
//
//     let mut guard = STATE.lock().map_err(|_| "STATE.lock failed")?;
//     *guard = Some(State {
//         grid,
//         mesh_grid,
//         complex,
//         grid_index_to_reduction: HashMap::new(),
//         swaps0: Vec::new(),
//         swaps1: Vec::new(),
//         swaps2: Vec::new(),
//     });
//     Ok(())
// }
//
// /// Loads the state from a serialized byte buffer.
// #[wasm_bindgen]
// pub fn load_state(
//     bytes: JsValue,
//     grid_offset: JsValue,
//     _: js_sys::Function,
// ) -> Result<JsValue, JsValue> {
//     let offset: Index = serde_wasm_bindgen::from_value(grid_offset)?;
//     info_mem("load-state");
//     let mut state: State = {
//         let bytes: serde_bytes::ByteBuf = serde_wasm_bindgen::from_value(bytes)?;
//         info_mem("after ByteBuf");
//         rmp_serde::from_slice(&bytes).map_err(|e| format!("rmp_serde failed: {}", e.to_string()))?
//     };
//     info_mem("after RMP");
//
//     {
//         let out: StackMem = state
//             .grid_index_to_reduction
//             .values()
//             .flat_map(|r| &r.stacks)
//             .map(|s| {
//                 let sm: StackMem = s.into();
//                 sm
//             })
//             .sum();
//         info!("{:#?}", out);
//         let total_mem: usize = state
//             .grid_index_to_reduction
//             .values()
//             .flat_map(|r| &r.stacks)
//             .map(|s| s.mem_usage())
//             .sum();
//         info!("total: {}", total_mem)
//     }
//
//     let grid_index_to_reduction = state
//         .grid_index_to_reduction
//         .drain()
//         .map(|(k, v)| (k + offset, v))
//         .collect::<HashMap<_, _>>();
//     info_mem("after red drain");
//
//     let swaps0: Vec<_> = state
//         .swaps0
//         .drain(0..)
//         .map(|s| (s.0 + offset, s.1 + offset, s.2))
//         .collect();
//     info_mem("after state0 drain");
//     let swaps1: Vec<_> = state
//         .swaps1
//         .drain(0..)
//         .map(|s| (s.0 + offset, s.1 + offset, s.2))
//         .collect();
//     info_mem("after state1 drain");
//     let swaps2: Vec<_> = state
//         .swaps2
//         .drain(0..)
//         .map(|s| (s.0 + offset, s.1 + offset, s.2))
//         .collect();
//     info_mem("after state2 drain");
//
//     info!(
//         "swaps: dim0={}  dim1={}  dim2={}",
//         swaps0.len(),
//         swaps1.len(),
//         swaps2.len(),
//     );
//
//     let mut guard = STATE.lock().map_err(|_| "STATE.lock failed")?;
//     let state = guard.as_mut().ok_or("No global state")?;
//     state
//         .grid_index_to_reduction
//         .extend(grid_index_to_reduction);
//     info_mem("after red extend");
//
//     let existing_indices_0 = state
//         .swaps0
//         .iter()
//         .map(|(a, b, _)| (a, b))
//         .collect::<HashSet<_>>();
//     let new_indices_0 = swaps0
//         .into_iter()
//         .filter(|(a, b, _)| !existing_indices_0.contains(&(a, b)))
//         .collect::<Vec<_>>();
//     state.swaps0.extend(new_indices_0);
//     info_mem("after state0 extend");
//     let existing_indices_1 = state
//         .swaps1
//         .iter()
//         .map(|(a, b, _)| (a, b))
//         .collect::<HashSet<_>>();
//     let new_indices_1 = swaps1
//         .into_iter()
//         .filter(|(a, b, _)| !existing_indices_1.contains(&(a, b)))
//         .collect::<Vec<_>>();
//     state.swaps1.extend(new_indices_1);
//     info_mem("after state1 extend");
//     let existing_indices_2 = state
//         .swaps2
//         .iter()
//         .map(|(a, b, _)| (a, b))
//         .collect::<HashSet<_>>();
//     let new_indices_2 = swaps2
//         .into_iter()
//         .filter(|(a, b, _)| !existing_indices_2.contains(&(a, b)))
//         .collect::<Vec<_>>();
//     state.swaps2.extend(new_indices_2);
//     info_mem("after state2 extend");
//
//     let out = serde_wasm_bindgen::to_value("okay")?;
//     info_mem("end");
//
//     Ok(out)
// }
//
// /// Get the barcode for a single grid point from the precomputed state.
// #[wasm_bindgen]
// pub fn get_barcode_for_point(grid_point: Vec<isize>) -> Result<JsValue, String> {
//     let index = Index([grid_point[0], grid_point[1], grid_point[2]]);
//     let guard = STATE.lock().map_err(|_| "STATE.lock failed")?;
//     let state = guard.as_ref().ok_or("No global state")?;
//
//     let reduction = state
//         .grid_index_to_reduction
//         .get(&index)
//         .ok_or("Index not in map")?;
//
//     let swaps_1 = reduction.barcode(&state.complex, -1);
//     let swaps0 = reduction.barcode(&state.complex, 0);
//     let swaps1 = reduction.barcode(&state.complex, 1);
//     let swaps2 = reduction.barcode(&state.complex, 2);
//
//     let js: JsValue = serde_wasm_bindgen::to_value(&vec![swaps_1, swaps0, swaps1, swaps2])
//         .map_err(|e| e.to_string())?;
//     Ok(js)
// }
//
// /// Get the barcode for a single grid point from the precomputed state.
// #[wasm_bindgen]
// pub fn get_filtration_values_for_point(grid_point: Vec<isize>) -> Result<JsValue, String> {
//     let index = Index([grid_point[0], grid_point[1], grid_point[2]]);
//     let guard = STATE.lock().map_err(|_| "STATE.lock failed")?;
//     let state = guard.as_ref().ok_or("No global state")?;
//
//     let reduction = state
//         .grid_index_to_reduction
//         .get(&index)
//         .ok_or("Index not in map")?;
//
//     let filtration_0 = (0..state.complex.simplices_per_dim[0].len() as CI)
//         .map(|id| reduction.simplex_entering_value(&state.complex, 0, id))
//         .collect::<Vec<_>>();
//     let filtration_1 = (0..state.complex.simplices_per_dim[1].len() as CI)
//         .map(|id| reduction.simplex_entering_value(&state.complex, 1, id))
//         .collect::<Vec<_>>();
//     let filtration_2 = (0..state.complex.simplices_per_dim[2].len() as CI)
//         .map(|id| reduction.simplex_entering_value(&state.complex, 2, id))
//         .collect::<Vec<_>>();
//
//     let js: JsValue = serde_wasm_bindgen::to_value(&vec![filtration_0, filtration_1, filtration_2])
//         .map_err(|e| e.to_string())?;
//     Ok(js)
// }
//
// #[wasm_bindgen]
// /// Read a complex from a `String` consisting of an .obj file.
// pub fn make_complex_from_obj(obj_body: String) -> Result<JsValue, JsValue> {
//     let complex = Complex::read_from_obj_string(&obj_body)?;
//     serde_wasm_bindgen::to_value(&complex).map_err(|e| JsValue::from_str(&format!("{}", e)))
// }
//
// #[wasm_bindgen]
// /// Read a mesh from a `String` consisting of an .obj file.
// pub fn make_meshgrid_from_obj(obj_body: String) -> Result<JsValue, JsValue> {
//     let complex = VineyardsGridMesh::read_from_obj_string(&obj_body)?;
//     serde_wasm_bindgen::to_value(&complex).map_err(|e| JsValue::from_str(&format!("{}", e)))
// }
//
// /// Run pruning using the [PruningParam]s on the data in [State].
// pub fn prune<F: FnMut(&str, usize, usize)>(
//     st: &State,
//     params: &PruningParam,
//     dim: usize,
//     mut send_message: F,
// ) -> Vec<(Index, Index, Swaps)> {
//     let reduction_map = &st.grid_index_to_reduction;
//     let swaps_per_grid_pair = match dim {
//         0 => &st.swaps0,
//         1 => &st.swaps1,
//         2 => &st.swaps2,
//         _ => panic!("wat"),
//     };
//     let complex = &st.complex;
//
//     let mut grid_swaps_vec: Vec<(Index, Index, Swaps)> = Vec::new();
//     let prune_iters = swaps_per_grid_pair.len();
//
//     for (i, s) in swaps_per_grid_pair.into_iter().enumerate() {
//         if i & 127 == 0 {
//             send_message("Prune", i, prune_iters);
//         }
//         if s.2.v.len() == 0 {
//             continue;
//         }
//
//         let mut dim_swaps = s.2.clone();
//
//         if params.euclidean {
//             if let Some(dist) = params.euclidean_distance {
//                 dim_swaps.prune_euclidian(&complex, dist)
//             } else {
//                 warn!(
//                     "params dim {}: euclidean was true but distance was None",
//                     dim
//                 );
//             }
//         }
//
//         if params.face {
//             dim_swaps.prune_common_face(&complex);
//         }
//
//         if params.coface {
//             dim_swaps.prune_coboundary(&complex);
//         }
//
//         if params.persistence {
//             if let Some(dist) = params.persistence_threshold {
//                 let grid_index_a = s.0;
//                 let reduction_at_a = reduction_map.get(&grid_index_a).unwrap();
//                 let grid_index_b = s.1;
//                 let reduction_at_b = reduction_map.get(&grid_index_b).unwrap();
//                 dim_swaps.prune_persistence(&complex, reduction_at_a, reduction_at_b, dist)
//             } else {
//                 warn!(
//                     "params dim {}: persistence was true but threshold was None",
//                     dim
//                 );
//             }
//         }
//
//         grid_swaps_vec.push((s.0, s.1, dim_swaps));
//     }
//
//     grid_swaps_vec
// }
//
// /// Prune swaps for the given dimension using the [PruningParam]s.
// #[wasm_bindgen]
// pub fn prune_dimension(
//     dim: JsValue,
//     params: JsValue,
//     on_message: js_sys::Function,
// ) -> Result<JsValue, JsValue> {
//     let dim: usize = serde_wasm_bindgen::from_value(dim)?;
//     let send_message = |label: &str, i: usize, n: usize| {
//         on_message
//             .call3(
//                 &JsValue::NULL,
//                 &JsValue::from_str(label),
//                 &JsValue::from_f64(i as f64),
//                 &JsValue::from_f64(n as f64),
//             )
//             .unwrap();
//     };
//
//     let params: PruningParam = serde_wasm_bindgen::from_value(params)?;
//     let mut state = STATE.lock().unwrap();
//     let st = state.as_mut().unwrap();
//     let new_pruned = prune(st, &params, dim, send_message);
//     Ok(serde_wasm_bindgen::to_value(&new_pruned)?)
// }
//
// #[wasm_bindgen]
// pub fn split_grid(grid: JsValue) -> Result<JsValue, JsValue> {
//     let (grid, meshgrid) = mesh_from_jsvalue(grid)?;
//     if let Some(grid) = grid {
//         let (a, b, b_offset) = grid.split_with_overlap();
//
//         let (aa, ab, ab_offset) = a.split_with_overlap();
//         let (ba, bb, bb_offset) = b.split_with_overlap();
//
//         let grids = [
//             (aa, Index([0; 3])),
//             (ab, ab_offset),
//             (ba, b_offset),
//             (bb, b_offset + bb_offset),
//         ];
//         Ok(serde_wasm_bindgen::to_value(&grids)?)
//     } else if let Some(grid) = meshgrid {
//         let (a, b) = grid.split_in_half();
//         let (aa, ab) = a.split_in_half();
//         let (ba, bb) = b.split_in_half();
//         let fake = Index::fake(0);
//         let grids = [(aa, fake), (ab, fake), (ba, fake), (bb, fake)];
//         Ok(serde_wasm_bindgen::to_value(&grids)?)
//     } else {
//         Err("Failed to deserialize grid")?
//     }
// }
//
// /// Options
// #[derive(Deserialize, Debug, Default)]
// pub struct RunOptions {
//     /// Require that the faustian swaps involve the first birth of a given
//     /// dimension.
//     require_hom_birth_to_be_first: bool,
// }
//
// pub fn run_without_prune_inner(
//     grid: Option<VineyardsGrid>,
//     mesh_grid: Option<VineyardsGridMesh>,
//     complex: Complex,
//     options: RunOptions,
//     send_message: impl Fn(&str, usize, usize),
// ) -> Result<State> {
//     let mut results = if let Some(ref grid) = grid {
//         info!("found regular grid");
//         let i0 = Index([0; 3]);
//         let p = grid.coordinate(i0);
//         send_message("Reduce from scratch", 0, 1);
//         let s0 = reduce_from_scratch(&complex, p, false);
//         send_message("Run vineyards", 0, 1);
//         grid.run_vineyards_in_grid(
//             &complex,
//             i0,
//             s0,
//             options.require_hom_birth_to_be_first,
//             |i, n| {
//                 if i & 15 == 0 {
//                     send_message("Vineyards", i, n);
//                 }
//             },
//         )
//     } else if let Some(ref grid) = mesh_grid {
//         info!("found mesh grid");
//         grid.run_vineyards(&complex, options.require_hom_birth_to_be_first, |i, n| {
//             if i & 15 == 0 {
//                 send_message("Vineyards", i, n);
//             }
//         })
//     } else {
//         bail!("Hello");
//     };
//
//     // Bake permutations so that it is easier to serialize.
//     send_message("Bake data 🧑‍🍳", 0, 1);
//     for reduction in results.0.values_mut() {
//         for st in reduction.stacks.iter_mut() {
//             st.D.bake_in_permutations();
//             st.R.bake_in_permutations();
//             st.U_t.bake_in_permutations();
//         }
//     }
//
//     send_message("Move state to global", 0, 1);
//
//     fn filter_dim(v: &[(Index, Index, Swaps)], dim: usize) -> Vec<(Index, Index, Swaps)> {
//         v.iter()
//             .flat_map(|(i, j, s)| {
//                 let v: Vec<_> = s.v.iter().filter(|s| s.dim == dim).cloned().collect();
//                 (0 < v.len()).then(|| (*i, *j, Swaps { v }))
//             })
//             .collect()
//     }
//
//     Ok(State {
//         grid,
//         mesh_grid,
//         complex,
//         grid_index_to_reduction: results.0,
//         swaps0: filter_dim(&results.1, 0),
//         swaps1: filter_dim(&results.1, 1),
//         swaps2: filter_dim(&results.1, 2),
//     })
// }
//
// /// Run Vineyards, and set the global state with the output.
// #[wasm_bindgen]
// pub fn run_without_prune(
//     grid: JsValue,
//     complex: JsValue,
//     options: JsValue,
//     on_message: js_sys::Function,
// ) -> Result<(), JsValue> {
//     let send_message = |label: &str, i: usize, n: usize| {
//         on_message
//             .call3(
//                 &JsValue::NULL,
//                 &JsValue::from_str(label),
//                 &JsValue::from_f64(i as f64),
//                 &JsValue::from_f64(n as f64),
//             )
//             .unwrap();
//     };
//
//     let complex: Complex = serde_wasm_bindgen::from_value(complex)?;
//     let options: RunOptions = serde_wasm_bindgen::from_value(options)?;
//     info!("run_without_prune");
//
//     let (grid, mesh_grid) = mesh_from_jsvalue(grid)?;
//
//     let new_state = run_without_prune_inner(grid, mesh_grid, complex, options, send_message)
//         .map_err(|e| JsValue::from_str(&e.to_string()))?;
//     let mut state = STATE.lock().unwrap();
//     *state = Some(new_state);
//
//     Ok(())
// }
//
// /// Get the dual face in between two adjacent [Index] values in the grid.
// /// This only works if the current grid is a [MeshGrid].
// #[wasm_bindgen]
// pub fn meshgrid_dual_face(a: JsValue, b: JsValue) -> Result<JsValue, JsValue> {
//     let a: Index = serde_wasm_bindgen::from_value(a)?;
//     let b: Index = serde_wasm_bindgen::from_value(b)?;
//
//     let guard = STATE.lock().map_err(|_| "STATE.lock failed")?;
//     let state = guard.as_ref().ok_or("No global state")?;
//     let Some(ref grid) = state.mesh_grid else {
//         return Err("No mesh grid")?;
//     };
//
//     let a = grid.points[a.0[0] as usize];
//     let b = grid.points[b.0[0] as usize];
//     let dist = a.dist(&b);
//
//     let [ax, ay, az] = a.0;
//     let [bx, by, bz] = b.0;
//     let middle = a + (b - a) / 2.0;
//     let ret: [Pos; 4] = if (ax - bx).abs() > 1e-3 {
//         let p = Pos([0.0, dist / 2.0, 0.0]);
//         let q = Pos([0.0, 0.0, dist / 2.0]);
//         [
//             middle - p - q,
//             middle - p + q,
//             middle + p + q,
//             middle + p - q,
//         ]
//     } else if (ay - by).abs() > 1e-3 {
//         let p = Pos([dist / 2.0, 0.0, 0.0]);
//         let q = Pos([0.0, 0.0, dist / 2.0]);
//         [
//             middle - p - q,
//             middle - p + q,
//             middle + p + q,
//             middle + p - q,
//         ]
//     } else if (az - bz).abs() > 1e-3 {
//         let p = Pos([dist / 2.0, 0.0, 0.0]);
//         let q = Pos([0.0, dist / 2.0, 0.0]);
//         [
//             middle - p - q,
//             middle - p + q,
//             middle + p + q,
//             middle + p - q,
//         ]
//     } else {
//         panic!("bad points {:?} {:?}", a, b);
//     };
//
//     Ok(serde_wasm_bindgen::to_value(&ret)?)
// }
