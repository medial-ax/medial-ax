import * as Comlink from "comlink";
import wasm_init, {
  my_init_function,
  run,
  run_without_prune,
  get_barcode_for_point,
  prune_dimension,
  get_state,
  load_state,
  make_complex_from_obj,
} from "ma-rs";
import { Complex, Grid, Index, PruningParam } from "./types";
import { wait } from "./utils";

export class Mars {
  async init() {
    console.log("before wasm init");
    await wasm_init();
    console.log("after wasm init");
  }

  myInitFunction() {
    console.log("before my init function");
    my_init_function();
    console.log("after my init function");
  }

  makeComplexFromObj(obj: string) {
    return make_complex_from_obj(obj);
  }

  getBarcodeForPoint(point: Index) {
    return get_barcode_for_point(point);
  }

  async compute(
    grid: Grid,
    complex: Complex,
    cb: (label: string, i: number, n: number) => void,
  ) {
    await wait(10);
    return run_without_prune(grid, complex, cb);
  }

  async pruneDimension(
    dim: number,
    params: PruningParam,
    cb: (label: string, i: number, n: number) => Promise<void>,
  ) {
    await wait(10);
    const ret = prune_dimension(
      dim,
      params,
      async (label: string, i: number, n: number) => {
        await cb(label, i, n);
      },
    );
    console.log("worker done");
    return ret;
  }
}

Comlink.expose(Mars);

// function _run(fn: string, args: any) {
//   const onMessage = (label: string, i: number, n: number) => {
//     postMessage({
//       type: "progress",
//       data: {
//         label,
//         i,
//         n,
//       },
//     });
//   };
//   if (fn === "run") {
//     const { grid, complex, allPruningParams } = args;
//     const result = run(grid, complex, allPruningParams, onMessage);
//     postMessage({
//       type: "finished",
//       data: result,
//     });
//   } else if (fn === "run-and-dump") {
//     const { grid, complex, allPruningParams } = args;
//     run_without_prune(grid, complex, allPruningParams, onMessage);
//     postMessage({
//       type: "finished",
//       data: get_state(),
//     });
//   } else if (fn === "get-barcode-for-point") {
//     const { grid_point } = args;
//     const result = get_barcode_for_point(grid_point);
//     postMessage({
//       type: "finished",
//       data: result,
//     });
//   } else if (fn === "prune-dimension") {
//     const { dim, params } = args;
//     const result = prune_dimension(dim, params, onMessage);
//     postMessage({
//       type: "finished",
//       data: result,
//     });
//   } else if (fn === "get-state") {
//     postMessage({
//       type: "finished",
//       data: get_state(),
//     });
//   } else if (fn === "load-state") {
//     const { bytes, index } = args;
//     const res = load_state(bytes, index, (s: any) => console.log(s));
//     postMessage({
//       type: "finished",
//       data: res,
//     });
//   }
// }
//
// const queue: { fn: string; args: any }[] = [];
// onmessage = (e) => {
//   const { fn, args } = e.data;
//   queue.push({ fn, args });
// };
//
// onmessage = (e) => {
//   const { fn, args } = e.data;
//   _run(fn, args);
// };
