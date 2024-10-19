import { Dim, allPruningParamsAtom } from "../state";
import { atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import { mars } from "../global";
import { CollapseH4 } from "../ui/CollapseH4";
import { PruningParameters } from "./PruningParameters";
import { Loader } from "../ui/Loader";

import { range } from "../utils";

import VineyardsWorker from "../worrrker/vineyards?worker";
import SubMarsWorker from "../worrrker/vineyards2?worker";

const runningWorkerAtom = atom<Worker | undefined>(undefined);
const runningProgressAtom = atom<
  { label: string; i: number; n: number } | undefined
>(undefined);

const triggerVineyardsAtom = atom(null, async (get, set) => {
  const m = mars();

  m.subproblems().map((sub, i) => {
    const w = new SubMarsWorker();
    w.onmessage = (e) => {
      if (e.data.type === "progress") {
        set(runningProgressAtom, e.data.data);
      } else if (e.data.type === "result") {
        console.log(`worker ${i} finished`);
        m.deserialize_vineyards_load(e.data.data);
        w.terminate();
      }
    };

    w.postMessage(sub);
  });
  //
  // range(0, 4).map((i) => {
  //   const w = new VineyardsWorker();
  //
  //   w.onmessage = (e) => {
  //     if (e.data.type === "progress") {
  //       set(runningProgressAtom, e.data.data);
  //     } else if (e.data.type === "result") {
  //       mars().deserialize_vineyards(e.data.data);
  //       get(runningWorkerAtom)?.terminate();
  //       set(runningWorkerAtom, undefined);
  //       set(runningProgressAtom, undefined);
  //     } else {
  //       console.error(`unhandled worker message of type "${e.data.type}"`, e);
  //     }
  //   };
  //
  //   const pruningParams = get(allPruningParamsAtom);
  //   const m = mars();
  //   w.postMessage({
  //     core: m.serialize_core(),
  //     pruningParams,
  //   });
  //   set(runningWorkerAtom, w);
  // });
  //
  // w.onmessage = (e) => {
  //   if (e.data.type === "progress") {
  //     set(runningProgressAtom, e.data.data);
  //   } else if (e.data.type === "result") {
  //     mars().deserialize_vineyards(e.data.data);
  //     get(runningWorkerAtom)?.terminate();
  //     set(runningWorkerAtom, undefined);
  //     set(runningProgressAtom, undefined);
  //   } else {
  //     console.error(`unhandled worker message of type "${e.data.type}"`, e);
  //   }
  // };
  //
  // const pruningParams = get(allPruningParamsAtom);
  // w.postMessage({
  //   core: m.serialize_core(),
  //   pruningParams,
  // });
  // set(runningWorkerAtom, w);
});

export const MedialAxes = () => {
  const trigger = useSetAtom(triggerVineyardsAtom);
  const [currentWorker, setCurrentWorker] = useAtom(runningWorkerAtom);
  const progress = useAtomValue(runningProgressAtom);

  return (
    <>
      <h3>Medial axes</h3>

      <label>
        <input
          type="checkbox"
          checked={false}
          onChange={() => {
            window.alert("TODO");
          }}
        />
        <p>Only first swap </p>
      </label>

      <button
        onClick={() => {
          const ret = mars().subproblems();
          console.log("subproblems", ret);
        }}
      >
        DEBUG
      </button>

      <div className="row">
        <button
          style={{ flex: 1 }}
          disabled={false /* TODO */}
          onClick={() => trigger()}
        >
          {currentWorker ? <Loader $w0={20} $w1={60} /> : "Compute medial axes"}
        </button>
        {currentWorker && (
          <button
            onClick={() => {
              currentWorker.terminate();
              setCurrentWorker(undefined);
            }}
          >
            Abort
          </button>
        )}
      </div>

      {progress && (
        <label>
          <p>{progress.label}</p>
          {0 < progress.n && <progress value={progress.i / progress.n} />}
          <p className="percent">
            {Math.floor((progress.i / progress.n) * 100)}%
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
