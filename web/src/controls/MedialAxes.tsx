import { useCallback, useState } from "react";
import {
  Dim,
  allPruningParamsAtom,
  swapsAtom,
  workerRunningAtom,
} from "../state";
import { ExtractAtomValue, useAtom, useAtomValue } from "jotai";
import { makeWorker, resetWasmWorker, run } from "../work";
import { mars } from "../global";
import { sum } from "../utils";
import { CollapseH4 } from "../ui/CollapseH4";
import { PruningParameters } from "./PruningParameters";
import { toast } from "../Toast";
import { Loader } from "../ui/Loader";

import VineyardsWorker from "../worrrker/vineyards?worker";

function performTheComputation() {
  const w = new VineyardsWorker();
  let onMessage: (a: Uint8Array) => void = () => {};

  w.onmessage = (e) => {
    onMessage(e.data);
  };

  w.postMessage(mars().serialize_core());

  return new Promise<Uint8Array>((res) => {
    onMessage = res;
  });
}

export const MedialAxes = () => {
  // const [swaps, setSwaps] = useAtom(swapsAtom);
  // const anySwaps = useAtomValue(hasAnySwaps);
  const [workerRunning, setWorkerRunning] = useAtom(workerRunningAtom);
  const [workerProgress, setWorkerProgress] = useState<
    | undefined
    | {
        label: string;
        i: number;
        n: number;
      }
  >(undefined);

  const allPruningParams = useAtomValue(allPruningParamsAtom);

  const [onlyFirstSwap, setOnlyFirstSwap] = useState(false);

  const compute_the_things = useCallback(async () => {
    const m = mars();

    setWorkerRunning(true);

    const res = m.split_grid();

    const workerProgress = new Array(4).fill({ label: "Running", i: 0, n: 1 });
    const results = await Promise.all(
      res.map(async ([grid, offset], i: number) => {
        const { terminate, run } = makeWorker();
        try {
          const state = await run(
            "run-and-dump",
            {
              grid,
              complex: m.complex,
              allPruningParams,
              onlyFirstSwap,
            },
            (o) => {
              workerProgress[i] = o;
              const totalProgress = {
                label: o.label,
                i: sum(workerProgress, (o_1) => o_1.i),
                n: sum(workerProgress, (o_2) => o_2.n),
              };
              setWorkerProgress(totalProgress);
            },
          );
          return { state, offset };
        } finally {
          terminate();
        }
      }),
    );

    results.forEach(async (res: any) => {
      await run(
        "load-state",
        {
          bytes: res.state,
          index: res.offset,
        },
        (o) => setWorkerProgress(o),
      );
    });

    const pruned: ExtractAtomValue<typeof swapsAtom> = {
      0: await run(
        "prune-dimension",
        {
          dim: 0,
          params: allPruningParams[0],
        },
        (o) => setWorkerProgress(o),
      ),
      1: await run(
        "prune-dimension",
        {
          dim: 1,
          params: allPruningParams[1],
        },
        (o) => setWorkerProgress(o),
      ),
      2: await run(
        "prune-dimension",
        {
          dim: 2,
          params: allPruningParams[2],
        },
        (o) => setWorkerProgress(o),
      ),
    };
    console.log({ pruned });
  }, [allPruningParams, onlyFirstSwap, setWorkerRunning]);

  return (
    <>
      <h3>Medial axes</h3>

      <label>
        <input
          type="checkbox"
          checked={onlyFirstSwap}
          onChange={(e) => {
            setOnlyFirstSwap(e.target.checked);
          }}
        />
        <p>Only first swap</p>
      </label>

      <div className="row">
        <button
          onClick={async () => {
            const res = await performTheComputation();
            mars().deserialize_vineyards(res);
          }}
        >
          DEBUG
        </button>
        <button
          style={{ flex: 1 }}
          disabled={false /* TODO */}
          onClick={async () =>
            compute_the_things()
              .catch((err) => {
                const s = err instanceof Error ? err.message : String(err);
                toast("error", s, 10);
              })
              .finally(() => {
                setWorkerProgress(undefined);
                setWorkerRunning(false);
              })
          }
        >
          {workerRunning ? <Loader $w0={20} $w1={60} /> : "Compute medial axes"}
        </button>
        {workerRunning && (
          <button
            onClick={() => {
              setWorkerRunning(false);
              setWorkerProgress(undefined);
              resetWasmWorker();
            }}
          >
            Abort
          </button>
        )}
      </div>

      {workerProgress && (
        <label>
          <p>{workerProgress.label}</p>
          {0 < workerProgress.n && (
            <progress value={workerProgress.i / workerProgress.n} />
          )}
          <p className="percent">
            {Math.floor((workerProgress.i / workerProgress.n) * 100)}%
          </p>
        </label>
      )}

      <div className="pruning-param-list">
        {([0, 1, 2] satisfies Dim[]).map((dim) => (
          <CollapseH4 key={dim} title={`Pruning dim ${dim}`}>
            <PruningParameters dim={dim} disabled={false /* TODO */} />
          </CollapseH4>
        ))}
      </div>
    </>
  );
};
