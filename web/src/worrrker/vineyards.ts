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
  console.log("VW: got message");
  const m = await mars();
  console.log("VW: deserialize");

  const { core, pruningParams } = e.data;

  m.deserialize_core(core);
  console.log("VW: done");

  const res = m.run_vineyards();
  console.log("VW: vineyards", res);
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
