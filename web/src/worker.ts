import { exposeApi } from "threads-es/worker";
import wasm_init, {
  my_init_function,
  run_without_prune,
  prune_dimension,
  make_complex_from_obj,
} from "ma-rs";
import { Complex, Grid, PruningParam } from "./types";
import { TransferDescriptor } from "threads-es/shared";
import { wait } from "./utils";

type S = TransferDescriptor<
  WritableStream<{
    label: string;
    i: number;
    n: number;
  }>
>;

const api = {
  init: async () => {
    console.log("before wasm init");
    await wasm_init();
    console.log("after wasm init");
    console.log("before my init function");
    my_init_function();
    console.log("after my init function");
  },

  makeComplexFromObj(obj: string) {
    return make_complex_from_obj(obj);
  },

  compute: async (grid: Grid, complex: Complex, stream: S) => {
    console.log("compute: get writer");
    const writer = stream.send.getWriter();
    console.log("compute: await ready");
    await writer.ready;
    console.log("compute: write sample data");
    await writer.write({ label: "dumb", i: 0, n: 1 });
    console.log("compute: run rust");
    for (let i = 0; i < 100; i++) {
      setTimeout(() => {
        console.log("timeout i = ", i * 10);
      }, i * 10);
    }
    const ret = await run_without_prune(
      grid,
      complex,
      async (label: string, i: number, n: number) => {
        console.log("compute: callback", { label, i, n });
        await writer.write({ label, i, n });
        console.log("compute: callback after", { label, i, n });
      },
    );
    console.log("compute: close");
    await writer.close();
    console.log("compute: return");
    return ret;
  },

  pruneDimension: async (dim: number, params: PruningParam, stream: S) => {
    const writer = stream.send.getWriter();
    const ret = prune_dimension(
      dim,
      params,
      async (label: string, i: number, n: number) => {
        await writer.write({ label, i, n });
      },
    );
    await writer.close();
    return ret;
  },
};

export type Api = typeof api;
exposeApi(api);

// export class Mars {
//   makeComplexFromObj(obj: string) {
//     return make_complex_from_obj(obj);
//   }
//
//   getBarcodeForPoint(point: Index) {
//     return get_barcode_for_point(point);
//   }
//
// }
//
// Comlink.expose(Mars);
//
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
