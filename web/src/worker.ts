import init, {
  my_init_function,
  run,
  run_without_prune,
  get_barcode_for_point,
  prune_dimension,
  get_state,
  load_state,
} from "ma-rs";

function _run(fn: string, args: any) {
  const onMessage = (label: string, i: number, n: number) => {
    postMessage({
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
    const result = run(grid, complex, allPruningParams, onMessage);
    postMessage({
      type: "finished",
      data: result,
    });
  } else if (fn === "run-and-dump") {
    const { grid, complex, allPruningParams } = args;
    run_without_prune(grid, complex, allPruningParams, onMessage);
    postMessage({
      type: "finished",
      data: get_state(),
    });
  } else if (fn === "get-barcode-for-point") {
    const { grid_point } = args;
    const result = get_barcode_for_point(grid_point);
    postMessage({
      type: "finished",
      data: result,
    });
  } else if (fn === "prune-dimension") {
    const { dim, params } = args;
    const result = prune_dimension(dim, params, onMessage);
    postMessage({
      type: "finished",
      data: result,
    });
  } else if (fn === "get-state") {
    postMessage({
      type: "finished",
      data: get_state(),
    });
  } else if (fn === "load-state") {
    const { bytes, index } = args;
    const res = load_state(bytes, index, (s: any) => console.log(s));
    postMessage({
      type: "finished",
      data: res,
    });
  }
}

const queue: { fn: string; args: any }[] = [];
onmessage = (e) => {
  const { fn, args } = e.data;
  queue.push({ fn, args });
};

await init().then(() => {
  my_init_function();
  while (queue.length) {
    const { fn, args } = queue.shift()!;
    _run(fn, args);
  }
});

onmessage = (e) => {
  const { fn, args } = e.data;
  _run(fn, args);
};
