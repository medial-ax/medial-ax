import { atom, useAtom, useSetAtom } from "jotai";
import { Dim, pruningParamAtom } from "../state";
import { useState } from "react";
import { HoverTooltip } from "../HoverTooltip";
import { RESET } from "jotai/utils";
import PruneWorker from "../worrrker/prune?worker";
import { mars } from "../global";

type Progress = { label: string; i: number; n: number };

const triggerSinglePrune = atom(
  null,
  (get, _, dim: Dim, progress: (p: Progress | undefined) => void) => {
    const m = mars();

    const w = new PruneWorker();
    w.onmessage = (e) => {
      if (e.data.type === "progress") {
        progress(e.data.data);
      } else if (e.data.type === "result") {
        m.deserialize_pruned_swaps(dim, e.data.data);
        w.terminate();
        progress(undefined);
      }
    };

    w.onerror = (e) => {
      console.error(e);
      progress(undefined);
    };

    const params = get(pruningParamAtom(dim));

    progress({ label: "Serialize input", i: 0, n: 2 });
    const core = m.serialize_core();
    progress({ label: "Serialize input", i: 1, n: 2 });
    const vineyards = m.serialize_vineyards();
    progress({ label: "Serialize input", i: 2, n: 2 });

    w.postMessage({
      core,
      vineyards,
      dim,
      params,
    });
  },
);

export const PruningParameters = ({
  dim,
  disabled,
}: {
  dim: Dim;
  disabled: boolean;
}) => {
  const [params, set] = useAtom(pruningParamAtom(dim));
  const [workerProgress, setWorkerProgress] = useState<Progress | undefined>(
    undefined,
  );

  const trigger = useSetAtom(triggerSinglePrune);

  return (
    <>
      <label>
        <input
          type="checkbox"
          checked={params.euclidean}
          onChange={(e) => {
            set((c) => ({ ...c, euclidean: e.target.checked }));
          }}
        />
        <p>
          Euclidean pruning{" "}
          <HoverTooltip>
            Prunes a Faustian swap if the squared distance between the simplices
            responsible for the swap is less than the pruning distance.
          </HoverTooltip>
        </p>
      </label>
      <fieldset className="ranges-with-number" disabled={!params.euclidean}>
        <p>Pruning distance</p>
        <input
          type="range"
          min={0}
          max={5}
          step={0.01}
          value={params.euclidean_distance ?? 0}
          style={{ width: "8rem" }}
          onChange={(e) => {
            set((c) => ({ ...c, euclidean_distance: Number(e.target.value) }));
          }}
        />
        <input
          type="number"
          step={0.01}
          style={{ width: "5rem" }}
          value={params.euclidean_distance ?? 0}
          onChange={(e) => {
            set((c) => ({ ...c, euclidean_distance: Number(e.target.value) }));
          }}
        />
      </fieldset>

      <label>
        <input
          type="checkbox"
          checked={params.coface && dim !== 2}
          disabled={dim === 2}
          onChange={(e) => {
            set((c) => ({ ...c, coface: e.target.checked }));
          }}
        />
        <p>
          Coface pruning{" "}
          <HoverTooltip>
            {dim === 2
              ? "This option does not make sense for dimension 2."
              : "Prunes a Faustian swap if the simplices responsible for the swap share a coface. Only for dimensions 0 and 1."}
          </HoverTooltip>
        </p>
      </label>

      <label>
        <input
          type="checkbox"
          disabled={dim === 0}
          checked={params.face}
          onChange={(e) => {
            set((c) => ({ ...c, face: e.target.checked }));
          }}
        />
        <p>
          Face pruning{" "}
          <HoverTooltip>
            {dim === 0
              ? "This option does not make sense for dimension 0."
              : "Prunes a Faustian swap if the simplices responsible for the swap share a face."}
          </HoverTooltip>
        </p>
      </label>

      <label>
        <input
          type="checkbox"
          checked={params.persistence}
          onChange={(e) => {
            set((c) => ({ ...c, persistence: e.target.checked }));
          }}
        />
        <p>
          Persistence pruning{" "}
          <HoverTooltip>
            Prunes a Faustian swap if both of the simplices responsible for the
            swap are associated to a homology class with a lifespan shorter than
            the pruning lifespan.
          </HoverTooltip>
        </p>
      </label>
      <fieldset className="ranges-with-number" disabled={!params.persistence}>
        <p>Pruning lifespan</p>
        <input
          disabled={!params.persistence}
          type="range"
          min={0}
          max={1}
          step={0.01}
          style={{ width: "8rem" }}
          value={params.persistence_threshold ?? 0.01}
          onChange={(e) => {
            set((c) => ({
              ...c,
              persistence_threshold: Number(e.target.value),
            }));
          }}
        />
        <input
          type="number"
          step={0.01}
          style={{ width: "5rem" }}
          value={params.persistence_threshold ?? 0}
          onChange={(e) => {
            set((c) => ({
              ...c,
              persistence_threshold: Number(e.target.value),
            }));
          }}
        />
      </fieldset>

      <div
        style={{
          display: "flex",
          gap: "1rem",
          justifyContent: "end",
          alignItems: "center",
        }}
      >
        {workerProgress && (
          <progress value={workerProgress.i / workerProgress.n} />
        )}
        <div>
          <button
            disabled={workerProgress !== undefined || disabled}
            onClick={async () => {
              trigger(dim, (p) => setWorkerProgress(p));
            }}
          >
            Re-prune
          </button>
          <HoverTooltip
            style={{
              opacity: disabled ? 0.5 : 1.0,
            }}
          >
            Reprunes the {{ 0: "0th", 1: "1st", 2: "2nd" }[dim]} medial axis
            with the given paramters, and updates the visualization.
          </HoverTooltip>
        </div>

        <div>
          <button onClick={() => set(RESET)}>Reset</button>
          <HoverTooltip>
            Resets the parameters to the default values.
          </HoverTooltip>
        </div>
      </div>
    </>
  );
};
