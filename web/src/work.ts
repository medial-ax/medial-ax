import init, { my_init_function } from "ma-rs";
import WasmWorker from "./worker?worker";

export let wasmWorker = new WasmWorker();
export const resetWasmWorker = () => {
  wasmWorker.terminate();
  wasmWorker = new WasmWorker();
};

await init().then(() => {
  my_init_function();
});
