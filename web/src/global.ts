import init, { Api } from "mars_wasm";

await init();
let inner: Api | undefined = undefined;
export function mars(): Api {
  if (inner === undefined) {
    inner = new Api();
  }
  return inner;
}
