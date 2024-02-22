use wasm_bindgen::prelude::*;

use crate::{
    complex::Complex,
    grid::{Grid, Index},
    reduce_from_scratch,
};
use log::{debug, info};

use std::panic;

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
pub fn run(grid: JsValue, complex: JsValue) -> Result<JsValue, JsValue> {
    let grid: Grid = serde_wasm_bindgen::from_value(grid)?;
    info!("{:?}", grid);

    let complex: Complex = serde_wasm_bindgen::from_value(complex)?;
    info!("{:?}", complex);

    let p = grid.center(Index([0; 3]));
    let s0 = reduce_from_scratch(&complex, p, false);
    let results = grid.run_vineyards_in_grid(&complex, s0);
    let swaps = results.1;
    Ok(serde_wasm_bindgen::to_value(&swaps)?)
}
