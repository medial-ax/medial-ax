// import * as Comlink from "comlink";
// import WasmWorker from "./worker?worker";
// import { Mars as _Mars } from "./worker";

// let worker = new WasmWorker();
// let MarsComlink = Comlink.wrap<typeof _Mars>(worker);
// export let Mars = await new MarsComlink();
// await Mars.init();
//
// export async function resetComlink() {
//   worker.terminate();
//   worker = new WasmWorker();
//   MarsComlink = Comlink.wrap<typeof _Mars>(worker);
//   Mars = await new MarsComlink();
//   await Mars.init();
// }
