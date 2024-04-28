import init, {
  my_init_function,
  run,
  run_without_prune,
  get_barcode_for_point,
  prune_dimension,
  get_state,
  load_state,
} from "ma-rs";

let _init = false;
const wait = () => new Promise((res) => setTimeout(() => res(0), 10));

async function _run(id: string, fn: string, args: any) {
  while (!_init) await wait();
  const onMessage = (label: string, i: number, n: number) => {
    postMessage({
      id,
      type: "progress",
      data: {
        label,
        i,
        n,
      },
    });
  };

  if (fn === "run") {
    const { grid, complex, allPruningParams } = args;
    return run(grid, complex, allPruningParams, onMessage);
  } else if (fn === "run-and-dump") {
    const { grid, complex, allPruningParams } = args;
    run_without_prune(grid, complex, allPruningParams, onMessage);
    return get_state();
  } else if (fn === "get-barcode-for-point") {
    const { grid_point } = args;
    return get_barcode_for_point(grid_point);
  } else if (fn === "prune-dimension") {
    const { dim, params } = args;
    return prune_dimension(dim, params, onMessage);
  } else if (fn === "get-state") {
    return get_state();
  } else if (fn === "load-state") {
    const { bytes, index } = args;
    return load_state(bytes, index, (s: any) => console.log(s));
  } else if (fn === "sleep") {
    await new Promise((res) => setTimeout(() => res(0), args.time));
    return "awake";
  } else if (fn === "ping") {
    return "pong";
  } else {
    throw new Error(`unknown function ${fn}`);
  }
}

onmessage = (e) => {
  const { id, fn, args } = e.data;
  try {
    _run(id, fn, args).then((result) => {
      postMessage({
        id,
        type: "finished",
        data: result,
      });
    });
  } catch (e: any) {
    console.log("error in worker", e);
    postMessage({
      id,
      type: "error",
      data: e.message,
    });
  }
};

await init().then(() => {
  my_init_function();
  _init = true;
});
