import init, {
  my_init_function,
  run,
  run_without_prune,
  get_barcode_for_point,
  prune_dimension,
  get_state,
  load_state,
} from "ma-rs";

function _run(id: string, fn: string, args: any) {
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
    const { grid, complex } = args;
    run_without_prune(grid, complex, onMessage);
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
  } else if (fn === "ping") {
    return "pong";
  } else {
    throw new Error(`unknown function ${fn}`);
  }
}

const queue: { id: string; fn: string; args: any }[] = [];
onmessage = (e) => {
  const { id, fn, args } = e.data;
  queue.push({ id, fn, args });
};

await init().then(() => {
  my_init_function();
  while (queue.length) {
    const { id, fn, args } = queue.shift()!;
    _run(id, fn, args);
  }
});

onmessage = (e) => {
  const { id, fn, args } = e.data;
  try {
    const result = _run(id, fn, args);
    postMessage({
      id,
      type: "finished",
      data: result,
    });
  } catch (e: any) {
    postMessage({
      id,
      type: "error",
      data: e.message,
    });
  }
};
