import init, { my_init_function, Api } from "mars_wasm";

await init();
my_init_function();
let inner: Api | undefined = undefined;
export function mars(): Api {
  if (inner === undefined) {
    inner = new Api();
  }
  return inner;
}
