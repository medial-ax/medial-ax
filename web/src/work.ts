import init, { my_init_function } from "ma-rs";
import WasmWorker from "./worker?worker";

type Message = {
  type: "progress" | "finished" | "error";
  id: string;
  data: any;
};

let worker = new WasmWorker();

type OnProgress = ({
  label,
  i,
  n,
}: {
  label: string;
  i: number;
  n: number;
}) => void;

const callbacks: Record<
  string,
  {
    res: (a: any) => void;
    rej: (a: any) => void;
    progress?: OnProgress;
  }
> = {};

const onmessage = (event: any) => {
  const { id, type, data } = event.data as Message;

  if (type === "finished") callbacks[id]?.res(data);
  else if (type === "error") callbacks[id]?.rej(data);
  else if (type === "progress") callbacks[id]?.progress?.(data);
  else {
    throw new Error(`weird type ${type}`);
  }
};

const onerror = (err: any) => {
  console.log("onerror", err);
  window.alert("web worker error, check console");
};

worker.onmessage = onmessage;
worker.onerror = onerror;

export const run = async (
  fn: string,
  args: any,
  progress?: OnProgress,
): Promise<any> => {
  const id = btoa(String(Math.random()).slice(2));

  worker.postMessage({
    id,
    fn,
    args,
  });

  return new Promise((res, rej) => {
    callbacks[id] = { res, rej, progress };
  });
};

export const resetWasmWorker = () => {
  worker.terminate();
  worker = new WasmWorker();
  worker.onmessage = onmessage;
  worker.onerror = onerror;
};

await init().then(() => {
  my_init_function();
});
