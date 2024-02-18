use wasm_bindgen::prelude::*;

use crate::complex::Complex;
use log::debug;

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
