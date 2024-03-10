import init, { my_init_function, run } from "ma-rs";

await init().then(() => {
  my_init_function();
});

onmessage = (e) => {
  const { grid, complex, allPruningParams } = e.data;
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
};
