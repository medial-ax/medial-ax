use wasm_bindgen::prelude::*;

use crate::complex::Complex;

#[wasm_bindgen]
pub fn make_complex_from_obj(obj_body: String) -> JsValue {
    let complex = Complex::read_from_obj_string(&obj_body);
    serde_wasm_bindgen::to_value(&complex).unwrap()
}
