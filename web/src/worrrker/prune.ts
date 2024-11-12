import init, { Api } from "mars_wasm";

function progress(label: string, i: number, n: number) {
  postMessage({
    type: "progress",
    data: { label, i, n },
  });
}

onmessage = async (e) => {
  const { core, vineyards, dim, params } = e.data;
  await init();
  progress("Read input", 0, 1);
  const m = new Api();

  progress("Deserialize input", 0, 6);
  m.deserialize_core(core);
  progress("Deserialize input", 1, 6);
  m.deserialize_vineyards(vineyards);
  progress("Deserialize input", 2, 6);

  progress("Pruning", 3, 6);
  m.prune(dim, params, progress);

  progress("Serialize output", 99, 100);
  const data = m.serialize_pruned_swaps(dim);

  postMessage({
    type: "result",
    data,
  });
};

onmessageerror = (e) => {
  console.error(e);
  postMessage(`got message error: ${e.data}`);
};
