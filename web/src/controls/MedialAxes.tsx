import { Dim } from "../state";
import { atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import { mars } from "../global";
import { CollapseH4 } from "../ui/CollapseH4";
import { PruningParameters } from "./PruningParameters";
import { Loader } from "../ui/Loader";

import SubMarsWorker from "../worrrker/vineyards2?worker";
import { Progress } from "../types";
import { sum } from "../utils";

/** All currently running workers */
const activeWorkers = atom<Worker[]>([]);
const progressAtom = atom<(Progress | undefined)[]>();
const totalProgress = atom<Progress | undefined>((get) => {
  const ps = get(progressAtom);
  if (!ps) return undefined;
  const i = sum(ps, (p) => p?.i ?? 0);
  const n = sum(ps, (p) => p?.n ?? 0);
  if (n === 0) return undefined;
  return { label: "Vineyards", i, n };
});

const triggerVineyardsAtom = atom(null, (_, set) => {
  const m = mars();

  const subproblems = m.subproblems();
  set(
    progressAtom,
    subproblems.map((_) => ({
      label: "Vineyards",
      i: 0,
      n: 1,
    })),
  );

  subproblems.map((sub, i) => {
    const w = new SubMarsWorker();
    set(activeWorkers, (c) => c.concat([w]));

    w.onmessage = (e) => {
      if (e.data.type === "progress") {
        set(progressAtom, (curr) => {
          if (!curr) return curr;
          const ret = [...curr];
          ret[i] = e.data.data;
          return ret;
        });
      } else if (e.data.type === "result") {
        console.log(`worker ${i} finished`);
        m.deserialize_vineyards_load(e.data.data);
        w.terminate();
        set(progressAtom, (curr) => {
          if (!curr) return curr;
          const ret = [...curr];
          ret[i] = undefined;
          return ret;
        });
        set(activeWorkers, (curr) => curr.filter((c) => c !== w));
      }
    };

    w.onerror = (e) => {
      console.error(e);
    };

    w.postMessage(sub);
  });
});

const terminateWorkersAtom = atom(null, (get, set) => {
  const ws = get(activeWorkers);
  for (const w of ws) w.terminate();
  set(activeWorkers, []);
  set(progressAtom, []);
});

export const MedialAxes = () => {
  const trigger = useSetAtom(triggerVineyardsAtom);
  const terminate = useSetAtom(terminateWorkersAtom);
  const progress = useAtomValue(totalProgress);

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

      <div className="row">
        <button
          style={{ flex: 1 }}
          disabled={false /* TODO */}
          onClick={() => trigger()}
        >
          {progress ? <Loader $w0={20} $w1={60} /> : "Compute medial axes"}
        </button>
        {progress && <button onClick={() => terminate()}>Abort</button>}
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
