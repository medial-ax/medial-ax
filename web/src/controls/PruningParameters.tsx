import { useAtom } from "jotai";
import { Dim, pruningParamAtom } from "../state";
import { useState } from "react";
import { HoverTooltip } from "../HoverTooltip";
import { RESET } from "jotai/utils";

export const PruningParameters = ({
  dim,
  disabled,
}: {
  dim: Dim;
  disabled: boolean;
}) => {
  const [params, set] = useAtom(pruningParamAtom(dim));
  const [workerProgress] = useState<
    { label: string; i: number; n: number } | undefined
  >(undefined);

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
          value={params.euclideanDistance ?? 0}
          style={{ width: "8rem" }}
          onChange={(e) => {
            set((c) => ({ ...c, euclideanDistance: Number(e.target.value) }));
          }}
        />
        <input
          type="number"
          step={0.01}
          style={{ width: "5rem" }}
          value={params.euclideanDistance ?? 0}
          onChange={(e) => {
            set((c) => ({ ...c, euclideanDistance: Number(e.target.value) }));
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
          value={params.persistenceThreshold ?? 0.01}
          onChange={(e) => {
            set((c) => ({
              ...c,
              persistenceThreshold: Number(e.target.value),
            }));
          }}
        />
        <input
          type="number"
          step={0.01}
          style={{ width: "5rem" }}
          value={params.persistenceThreshold ?? 0}
          onChange={(e) => {
            set((c) => ({
              ...c,
              persistenceThreshold: Number(e.target.value),
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
              window.alert("TODO a394e884-5dda-4846-8417-92f685ce0b73");
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
