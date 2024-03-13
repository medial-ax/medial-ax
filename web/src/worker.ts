import init, { my_init_function, run, get_barcode_for_point } from "ma-rs";

await init().then(() => {
  my_init_function();
});

onmessage = (e) => {
  const { fn, args } = e.data;

  if (fn === "run") {
    const { grid, complex, allPruningParams } = args;
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
  }
};
