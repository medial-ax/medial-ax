import init, { my_init_function, run_sub_mars } from "mars_wasm";

function progress(label: string, i: number, n: number) {
  postMessage({
    type: "progress",
    data: { label, i, n },
  });
}

onmessage = async (e) => {
  await init();
  my_init_function();
  const submars = e.data;
  progress("Read input", 0, 1);
  const vineyards = run_sub_mars(submars, progress);
  postMessage({
    type: "result",
    data: vineyards,
  });
};

onmessageerror = (e) => {
  console.error(e);
  postMessage(`got message error: ${e.data}`);
};
