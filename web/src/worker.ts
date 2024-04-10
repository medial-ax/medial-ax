import init, {
  my_init_function,
  run,
  get_barcode_for_point,
  prune_dimension,
  get_state,
  load_state,
} from "ma-rs";

await init().then(() => {
  my_init_function();
});

onmessage = (e) => {
  const { fn, args } = e.data;

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
    const { bytes } = args;
    const res = load_state(bytes, (s) => console.log(s));
    postMessage({
      type: "finished",
      data: res,
    });
  }
};
