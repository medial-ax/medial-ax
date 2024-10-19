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

function progress(label: string, i: number, n: number) {
  postMessage({
    type: "progress",
    data: { label, i, n },
  });
}

onmessage = async (e) => {
  const submars = e.data;

  const m = await mars();
  progress("Read input", 0, 1);
  m.deserialize_submars(submars);

  m.run_vineyards(progress);

  progress("Read input", 0, 1);
  const output = m.serialize_submars();
  postMessage({
    type: "result",
    data: output,
  });
};

onmessageerror = (e) => {
  console.error(e);
  postMessage(`got message error: ${e.data}`);
};
