use anyhow::Result;
use mars_core::complex::Complex;
use mars_core::grid::VineyardsGridMesh;
use mars_core::{Grid, Mars, PruningParam, SubMars, Vineyards};
use serde::Serializer;
use wasm_bindgen::prelude::*;

use mars_core::{grid::VineyardsGrid, SwapList};
use tracing::{debug, error, info, trace, warn};

use std::{collections::HashMap, panic};

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
fn info_mem() {
    let bytes = ALLOCATOR.allocated_now();
    let kb = bytes / 1024;
    let mb = kb / 1024;
    let perc = 100.0 * mb as f64 / 4096.0;
    trace!("🐊 {bytes:10} {kb:7} kB {mb:4} MB {perc:3.0}% 🐊");
}

/// Initializes logging and panic hooks for debugging.
#[wasm_bindgen(start)]
pub fn start() {
    console_error_panic_hook::set_once();
    tracing_wasm::set_as_global_default();
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
    on_pruned_change: Option<js_sys::Function>,
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

    fn notify_pruned_change(&self) {
        if let Some(ref f) = self.on_pruned_change {
            let _ = f.call0(&JsValue::null());
        }
    }

    fn set_mars(&mut self, c: Mars) {
        self.core = c;
        self.notify_complex_change();
        self.notify_grid_change();
        self.set_vineyards(None);
    }

    fn set_complex(&mut self, c: Option<Complex>) {
        self.core.complex = c;
        self.notify_complex_change();
        self._set_grid(None);
    }

    fn _set_grid(&mut self, g: Option<Grid>) {
        self.core.grid = g;
        self.notify_grid_change();
        self.set_vineyards(None);
    }

    fn set_vineyards(&mut self, v: Option<mars_core::Vineyards>) {
        self.vineyards = v;
        self.notify_vineyards_change();
        self.set_pruned_swaps([None, None, None]);
    }

    fn set_pruned_swaps(&mut self, ps: [Option<(PruningParam, SwapList)>; 3]) {
        self.pruned_swaps = ps;
        self.notify_pruned_change();
    }

    fn set_one_pruned_swaps(&mut self, i: usize, s: Option<(PruningParam, SwapList)>) {
        self.pruned_swaps[i] = s;
        self.notify_pruned_change();
    }
}

#[wasm_bindgen]
impl Api {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Api {
        Default::default()
    }

    pub fn set_on_complex_change(&mut self, f: js_sys::Function) {
        self.on_complex_change = Some(f);
    }

    pub fn set_on_grid_change(&mut self, f: js_sys::Function) {
        self.on_grid_change = Some(f);
    }

    pub fn set_on_vineyards_change(&mut self, f: js_sys::Function) {
        self.on_vineyards_change = Some(f);
    }

    pub fn set_on_pruned_change(&mut self, f: js_sys::Function) {
        self.on_pruned_change = Some(f);
    }

    pub fn load_complex(&mut self, obj_str: String) -> Result<(), String> {
        let cplx = mars_core::complex::Complex::read_from_obj_string(&obj_str)?;
        self.set_complex(Some(cplx));
        Ok(())
    }

    #[wasm_bindgen(getter)]
    pub fn complex(&self) -> Result<JsValue, String> {
        let Some(ref c) = self.core.complex else {
            return Ok(JsValue::undefined());
        };
        serde_wasm_bindgen::to_value(&c).map_err(|e| e.to_string())
    }

    pub fn load_mesh_grid(&mut self, obj_str: String) -> Result<(), String> {
        let grid = Grid::Mesh(VineyardsGridMesh::read_from_obj_string(&obj_str)?);
        self._set_grid(Some(grid));
        Ok(())
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
        self._set_grid(Some(Grid::Regular(grid)));
        Ok(())
    }

    /// Flattened coordinates for every face of the complex, GL style.
    pub fn face_positions(&self) -> Result<Vec<f64>, String> {
        info!("Api.face_positions");
        let mut ret = Vec::new();
        let Some(ref c) = self.core.complex else {
            return Ok(vec![]);
        };
        for simplex in &c.simplices_per_dim[2] {
            let e0 = simplex.boundary[0] as usize;
            let e1 = simplex.boundary[1] as usize;
            let e2 = simplex.boundary[2] as usize;

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
            Grid::Regular(grid) => {
                for s in swaps {
                    if 0 < s.2.v.len() {
                        let [a, b, c, d] = grid.dual_quad_points(s.0, s.1);
                        for p in &[a, b, c, a, c, d] {
                            out.extend_from_slice(&[p.x(), p.y(), p.z()]);
                        }
                    }
                }
            }
            Grid::Mesh(grid) => {
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
        info_mem();

        Ok(out.into_iter().map(|n| n as f32).collect())
    }

    pub fn subproblems(&self) -> Result<Vec<JsValue>, JsValue> {
        let subs = self.core.split_into_4()?;

        let mut buffers = Vec::new();

        for i in 0..4 {
            let bytes = rmp_serde::to_vec(&subs[i]).map_err(|e| e.to_string())?;
            debug!("serialize_core: {:.2} MB", mb(bytes.len()));
            let serializer = serde_wasm_bindgen::Serializer::new();
            let ret = serializer.serialize_bytes(&bytes)?;
            buffers.push(ret);
        }

        Ok(buffers)
    }

    pub fn serialize_core(&self) -> Result<JsValue, JsValue> {
        let bytes = rmp_serde::to_vec(&self.core).map_err(|e| e.to_string())?;
        debug!("serialize_core: {:.2} MB", mb(bytes.len()));
        let serializer = serde_wasm_bindgen::Serializer::new();
        let ret = serializer.serialize_bytes(&bytes)?;
        Ok(ret)
    }

    pub fn deserialize_core(&mut self, value: JsValue) -> Result<(), JsValue> {
        let bytes: serde_bytes::ByteBuf = serde_wasm_bindgen::from_value(value)?;
        let core: Mars = rmp_serde::from_slice(&bytes)
            .map_err(|e| format!("rmp_serde failed: {}", e.to_string()))?;
        debug!("deserialize_core: {:.2} MB", mb(bytes.len()));
        self.set_mars(core);
        Ok(())
    }

    pub fn serialize_vineyards(&self) -> Result<JsValue, JsValue> {
        let Some(ref vineyards) = self.vineyards else {
            info!("serialize_vineyards: no vineyards");
            return Ok(JsValue::undefined());
        };
        let bytes = rmp_serde::to_vec(vineyards).map_err(|e| e.to_string())?;
        debug!("serialize_vineyards: {:.2} MB", mb(bytes.len()));
        let serializer = serde_wasm_bindgen::Serializer::new();
        let ret = serializer.serialize_bytes(&bytes)?;
        Ok(ret)
    }

    pub fn deserialize_vineyards(&mut self, value: JsValue) -> Result<(), JsValue> {
        let bytes: serde_bytes::ByteBuf = serde_wasm_bindgen::from_value(value)?;
        let vineyards: Vineyards = rmp_serde::from_slice(&bytes)
            .map_err(|e| format!("rmp_serde failed: {}", e.to_string()))?;
        debug!("deserialize_vineyards: {:.2} MB", mb(bytes.len()));
        self.set_vineyards(Some(vineyards));
        Ok(())
    }

    pub fn deserialize_vineyards_load(&mut self, value: JsValue) -> Result<(), JsValue> {
        let bytes: serde_bytes::ByteBuf = serde_wasm_bindgen::from_value(value)?;
        let mut vineyards: Vineyards = rmp_serde::from_slice(&bytes)
            .map_err(|e| format!("rmp_serde failed: {}", e.to_string()))?;
        debug!("deserialize_vineyards_load: {:.2} MB", mb(bytes.len()));

        if let Some(ref mut v) = self.vineyards {
            for dim in 0..3 {
                // Properly merge in swaps for existing grid index pairs so that we don't get
                // duplicates.
                let swaps = &mut v.swaps[dim];
                let ij_to_index = swaps
                    .iter()
                    .enumerate()
                    .map(|(i, (a, b, _))| ((*a, *b), i))
                    .collect::<HashMap<_, _>>();

                for (i, j, new_swaps) in std::mem::take(&mut vineyards.swaps[dim]).into_iter() {
                    if let Some(k) = ij_to_index.get(&(i, j)) {
                        swaps[*k].2.v.extend_from_slice(&new_swaps.v);
                    } else {
                        swaps.push((i, j, new_swaps));
                    }
                }
            }
        } else {
            self.set_vineyards(Some(vineyards));
        }

        self.notify_vineyards_change();
        self.set_pruned_swaps([None, None, None]);
        Ok(())
    }

    pub fn serialize_pruned_swaps(&self, dim: usize) -> Result<JsValue, JsValue> {
        let bytes = rmp_serde::to_vec(&self.pruned_swaps[dim]).map_err(|e| e.to_string())?;
        debug!("serialize_pruned_swaps: {:.2} MB", mb(bytes.len()));
        let serializer = serde_wasm_bindgen::Serializer::new();
        let ret = serializer.serialize_bytes(&bytes)?;
        Ok(ret)
    }

    pub fn deserialize_pruned_swaps(&mut self, dim: usize, buffer: JsValue) -> Result<(), JsValue> {
        let bytes: serde_bytes::ByteBuf = serde_wasm_bindgen::from_value(buffer)?;
        let pruned: Option<(PruningParam, SwapList)> = rmp_serde::from_slice(&bytes)
            .map_err(|e| format!("rmp_serde failed: {}", e.to_string()))?;
        debug!("deserialize_vineyards: {:.2} MB", mb(bytes.len()));
        self.set_one_pruned_swaps(dim, pruned);
        Ok(())
    }

    pub fn deserialize_from_cli(&mut self, buffer: JsValue) -> Result<(), JsValue> {
        let bytes: serde_bytes::ByteBuf = serde_wasm_bindgen::from_value(buffer)?;
        let (mars, vineyards): (Mars, Vineyards) = rmp_serde::from_slice(&bytes)
            .map_err(|e| format!("rmp_serde failed: {}", e.to_string()))?;

        self.set_mars(mars);
        self.set_vineyards(Some(vineyards));

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
                    let _ = f
                        .call3(
                            &JsValue::NULL,
                            &JsValue::from_str("Pruning"),
                            &JsValue::from_f64(i as f64),
                            &JsValue::from_f64(n as f64),
                        )
                        .map_err(|e| {
                            error!("{:?}", e);
                        });
                }
            }
        });

        self.set_one_pruned_swaps(dim, Some((params, pruned)));
        Ok(())
    }
}

#[wasm_bindgen(typescript_custom_section)]
const _0: &'static str = r#"
/** Returns a serialized Vineyards. */
export function run_sub_mars(submars: Uint8Array): Uint8Array;
"#;
#[wasm_bindgen]
pub fn run_sub_mars(
    submars: JsValue,
    on_progress: Option<js_sys::Function>,
) -> Result<JsValue, JsValue> {
    let bytes: serde_bytes::ByteBuf = serde_wasm_bindgen::from_value(submars)?;
    let submars: SubMars = rmp_serde::from_slice(&bytes)
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
    debug!("run_sub_mars: {:.2} MB", mb(bytes.len()));
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
  set_on_pruned_change(f: () => void): void;

  load_complex(obj: string): void;
  load_mesh_grid(obj: string): void;
  set_grid(grid: VineyardsGrid): void;

  split_grid(): [VineyardsGrid, Index][] | [VineyardsGridMesh, Index][];

  get complex(): any;

  set grid(g: VineyardsGrid | VineyardsGridMesh);
  get grid(): VineyardsGrid | VineyardsGridMesh;

  run_vineyards(progress?: (label: string, i: number, n: number) => void): void;

  prune(dim: number, params: any, progress?: (label: string, i: number, n: number) => void): void;

  face_positions(): number[];
  medial_axes_face_positions(dim: number): Float32Array;

  /** Return four serialized `SubMars` instances. */
  subproblems(): [Uint8Array, Uint8Array, Uint8Array, Uint8Array];

  serialize_core(): Uint8Array;
  deserialize_core(c: Uint8Array): void;

  serialize_vineyards(): Uint8Array;
  deserialize_vineyards(c: Uint8Array): void;
  /** Add in more vineyards data.  The data is assumed to have been transformed to the same grid
   * coordinate system as this instance. */
  deserialize_vineyards_load(c: Uint8Array): void;

  serialize_pruned_swaps(dim: number): Uint8Array;
  deserialize_pruned_swaps(dim: number, buffer: Uint8Array): void;


  /** Load a file computed from the CLI. */
  deserialize_from_cli(buffer: Uint8Array): void;
}
"#;
