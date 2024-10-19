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
  m.deserialize_core(e.data);
  console.log("VW: done");

  const res = m.run_vineyards();
  console.log("VW: vineyards", res);
  postMessage(m.serialize_vineyards());
};

onmessageerror = (e) => {
  console.error(e);
  postMessage(`got message error: ${e.data}`);
};
