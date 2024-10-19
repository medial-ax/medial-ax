import init, { my_init_function, Api } from "mars_wasm";

let inner: Api | undefined = undefined;
async function mars(): Promise<Api> {
  if (inner === undefined) {
    await init();
    my_init_function();
    inner = new Api();
  }
  return inner;
}

onmessage = async (e) => {
  const { core, pruningParams } = e.data;

  const m = await mars();

  m.deserialize_core(core);
  console.log("VW: done");

  const progress = (label: string, i: number, n: number) => {
    postMessage({
      type: "progress",
      data: { label, i, n },
    });
  };

  postMessage({
    type: "progress",
    data: { label: "Starting vineyards", i: 0, n: 1 },
  });
  const res = m.run_vineyards(progress);

  progress("Pruning dim0", 0, 1);
  m.prune(0, pruningParams[0], progress);

  progress("Pruning dim1", 0, 1);
  m.prune(1, pruningParams[1], progress);

  progress("Pruning dim2", 0, 1);
  m.prune(2, pruningParams[2], progress);

  console.log("VW: vineyards", res);
  progress("Write output", 1, 2);
  const vineyards = m.serialize_vineyards();
  postMessage({
    type: "result",
    data: vineyards,
  });
};

onmessageerror = (e) => {
  console.error(e);
  postMessage(`got message error: ${e.data}`);
};
