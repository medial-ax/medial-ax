import { ExtractAtomValue, useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  Dim,
  allPruningParamsAtom,
  allSettingsAtom,
  complexAtom,
  gridAtom,
  gridForSwapsAtom,
  gridRadiusAtom,
  hasAnySwaps,
  keypointRadiusAtom,
  menuOpenAtom,
  pruningParamAtom,
  showGridAtom,
  showMAAtom,
  showObjectAtom,
  swapsAtom,
  swapsForMA,
  wireframeAtom,
  workerRunningAtom,
} from "./state";
import { useCallback, useRef, useState } from "react";
import { dualFaceQuad } from "./medialaxes";
import { downloadText, sum } from "./utils";
import styled from "styled-components";
import { Index } from "./types";
import { VineyardsGrid, split_grid } from "mars_wasm";
import { RESET } from "jotai/utils";
import { resetWasmWorker, run, makeWorker } from "./work";
import "./Controls.css";
import { HoverTooltip } from "./HoverTooltip";
import { toast } from "./Toast";
import { BuiltinMeshes } from "./controls/BuiltinMeshes";
import { UploadMeshGridFilePicker } from "./controls/UploadMeshGridFilePicker";
import { UploadObjFilePicker } from "./controls/UploadComplexFilePicker";
import { UploadStateFilePicker } from "./controls/UploadStateFilePicker";
import { GridControls } from "./controls/GridControls";

const Loader = styled.span<{
  $w0: number;
  $w1: number;
}>`
  width: ${(p) => p.$w0}px;
  height: 12px;

  display: block;
  margin: 2px auto;
  position: relative;
  border-radius: 4px;
  color: #bbb;
  background: currentColor;
  box-sizing: border-box;
  animation: animloader 0.6s 0.3s ease infinite alternate;

  &::after,
  &::before {
    content: "";
    box-sizing: border-box;
    width: ${(p) => p.$w0}px;
    height: 12px;
    background: currentColor;
    position: absolute;
    border-radius: 4px;
    top: 0;
    right: 110%;
    animation: animloader 0.6s ease infinite alternate;
  }
  &::after {
    left: 110%;
    right: auto;
    animation-delay: 0.6s;
  }

  @keyframes animloader {
    0% {
      width: ${(p) => p.$w0}px;
    }
    100% {
      width: ${(p) => p.$w1}px;
    }
  }
`;

const CollapseH4 = ({
  title,
  children,
}: React.PropsWithChildren<{ title: string }>) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>(0);
  return (
    <div className="collapse">
      <h4
        onClick={() => {
          if (!ref.current) return;
          const { height } = ref.current.getBoundingClientRect();
          if (open) setHeight(Math.ceil(height));
          setTimeout(() => {
            setOpen((c) => !c);
          }, 10);
        }}
      >
        {title}
      </h4>
      <div
        aria-hidden={!open}
        ref={ref}
        style={{
          maxHeight: open ? (height ? height : "initial") : "0",
        }}
      >
        {children}
      </div>
    </div>
  );
};

const PruningParameters = ({
  dim,
  disabled,
}: {
  dim: Dim;
  disabled: boolean;
}) => {
  const [params, set] = useAtom(pruningParamAtom(dim));
  const [workerProgress, setWorkerProgress] = useState<
    { label: string; i: number; n: number } | undefined
  >(undefined);
  const setSwaps = useSetAtom(swapsAtom);
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
              const swaps = await run("prune-dimension", { dim, params }, (o) =>
                setWorkerProgress(o),
              );
              setSwaps((c) => ({
                ...c,
                [dim]: swaps,
              }));
              setWorkerProgress(undefined);
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

const RenderOptions = () => {
  const zerothMA = useAtomValue(swapsForMA(0));
  const firstMA = useAtomValue(swapsForMA(1));
  const secondMA = useAtomValue(swapsForMA(2));

  const [keypointRadius, setKeypointRadius] = useAtom(keypointRadiusAtom);
  const [gridRadius, setGridRadius] = useAtom(gridRadiusAtom);
  const [showObject, setShowObject] = useAtom(showObjectAtom);
  const [wireframe, setWireframe] = useAtom(wireframeAtom);
  const [showMA, setShowMa] = useAtom(showMAAtom);
  const [showGrid, setShowGrid] = useAtom(showGridAtom);

  return (
    <>
      <h3>Render options</h3>
      <label>
        <input
          type="checkbox"
          checked={showObject}
          onChange={(e) => setShowObject(e.target.checked)}
        />
        <p>Show object</p>
      </label>
      <label>
        <input
          type="checkbox"
          checked={showGrid}
          onChange={(e) => {
            setShowGrid(e.target.checked);
          }}
        />
        <p>Show grid</p>
      </label>
      <label>
        <input
          type="checkbox"
          checked={wireframe}
          onChange={(e) => setWireframe(e.target.checked)}
        />
        <p>Wireframe</p>
      </label>
      <fieldset className="ranges-with-number">
        <p>Grid point size</p>
        <input
          type="range"
          min={0.001}
          max={0.1}
          step={0.001}
          value={gridRadius}
          onChange={(e) => {
            setGridRadius(Number(e.target.value));
          }}
        />
        <p>{gridRadius.toFixed(3)}</p>
        <p>Keypoint radius</p>
        <input
          type="range"
          min={0.01}
          max={0.5}
          step={0.001}
          value={keypointRadius}
          onChange={(e) => setKeypointRadius(Number(e.target.value))}
        />
        <p>{keypointRadius.toFixed(3)}</p>
      </fieldset>

      <fieldset>
        <legend>Show medial axes</legend>
        <label>
          <input
            type="checkbox"
            checked={showMA[0]}
            onChange={(e) => {
              setShowMa((c) => ({ ...c, 0: e.target.checked }));
            }}
            disabled={zerothMA.length === 0}
          />
          <p>Zeroth</p>
        </label>
        <label>
          <input
            type="checkbox"
            checked={showMA[1]}
            onChange={(e) => {
              setShowMa((c) => ({ ...c, 1: e.target.checked }));
            }}
            disabled={firstMA.length === 0}
          />
          <p> First </p>
        </label>
        <label>
          <input
            type="checkbox"
            checked={showMA[2]}
            onChange={(e) => {
              setShowMa((c) => ({ ...c, 2: e.target.checked }));
            }}
            disabled={secondMA.length === 0}
          />
          <p> Second </p>
        </label>
      </fieldset>
    </>
  );
};

export const Menu = () => {
  const [cplx] = useAtom(complexAtom);
  const [grid] = useAtom(gridAtom);
  const [swaps, setSwaps] = useAtom(swapsAtom);
  const anySwaps = useAtomValue(hasAnySwaps);
  const [workerRunning, setWorkerRunning] = useAtom(workerRunningAtom);
  const [workerProgress, setWorkerProgress] = useState<
    | undefined
    | {
        label: string;
        i: number;
        n: number;
      }
  >(undefined);

  const setGridForSwaps = useSetAtom(gridForSwapsAtom);
  const allPruningParams = useAtomValue(allPruningParamsAtom);

  const [open, setOpen] = useAtom(menuOpenAtom);
  const shownMA = useAtomValue(showMAAtom);
  const [exportVisible, setExportVisible] = useState(true);

  const [onlyFirstSwap, setOnlyFirstSwap] = useState(false);

  const [allSettings, setAllSettings] = useAtom(allSettingsAtom);

  const exportMAtoObj = useCallback(() => {
    if (!grid) return;
    if (grid.type === "meshgrid") {
      window.alert("Cannot export using meshgrid yet");
      return;
    }
    let obj = "";
    let v = 1;
    for (const ma of [0, 1, 2] satisfies Dim[]) {
      if (exportVisible && !shownMA[ma]) continue;
      obj += `o MA-${ma}\n`;
      for (const swap of swaps[ma]) {
        const hasAnySwaps = swap[2].v.find((s) => s.dim === ma);
        if (!hasAnySwaps) continue;
        const [p, q] = swap;
        const [a, b, c, d] = dualFaceQuad(grid, p, q);
        obj += `\
v ${a[0]} ${a[1]} ${a[2]}
v ${b[0]} ${b[1]} ${b[2]}
v ${c[0]} ${c[1]} ${c[2]}
v ${d[0]} ${d[1]} ${d[2]}
f ${v + 0} ${v + 1} ${v + 2} ${v + 3}
`;
        v += 4;
      }
    }

    const filename = cplx?.filename ?? "complex";
    downloadText(obj, `export-${filename}`);
  }, [cplx?.filename, exportVisible, grid, shownMA, swaps]);

  const compute_the_things = useCallback(async () => {
    setWorkerRunning(true);
    await run("create-empty-state", { grid, complex: cplx!.complex }, (o) =>
      setWorkerProgress(o),
    );

    const res = split_grid(grid);
    const workerProgress = new Array(4).fill({ label: "Running", i: 0, n: 1 });
    const results = await Promise.all(
      res.map(([grid, offset]: [VineyardsGrid, Index], i: number) => {
        const { terminate, run } = makeWorker();
        return run(
          "run-and-dump",
          {
            grid,
            complex: cplx!.complex,
            allPruningParams,
            onlyFirstSwap,
          },
          (o) => {
            workerProgress[i] = o;
            const totalProgress = {
              label: o.label,
              i: sum(workerProgress, (o) => o.i),
              n: sum(workerProgress, (o) => o.n),
            };
            setWorkerProgress(totalProgress);
          },
        )
          .then((state) => {
            return { state, offset };
          })
          .finally(() => {
            terminate();
          });
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

    setSwaps(pruned);
    setGridForSwaps(grid);
  }, [
    allPruningParams,
    cplx,
    grid,
    onlyFirstSwap,
    setGridForSwaps,
    setSwaps,
    setWorkerRunning,
  ]);

  return (
    <div id="controls">
      <button
        id="open-menu-button"
        aria-hidden={!!open}
        onClick={() => {
          setOpen(true);
        }}
      >
        Open menu
      </button>
      <div
        id="menu-container"
        style={{
          transform: open
            ? "translateX(0)"
            : "translateX(calc(-100% - 1.2rem))",
        }}
      >
        <div>
          <h2>Controls</h2>
          <button
            onClick={() => {
              setOpen(false);
            }}
          >
            Close
          </button>
        </div>

        <h3>Import / Export</h3>

        <h4>Import</h4>
        <UploadObjFilePicker />
        <UploadMeshGridFilePicker />
        <UploadStateFilePicker />

        <BuiltinMeshes />
        <label className="file">
          <p>Import settings</p>
          <input
            type="file"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              f.text().then((text) => {
                const j = JSON.parse(text);
                setAllSettings(j);
              });
            }}
          />
        </label>

        <h4>Export</h4>
        <label>
          <input
            type="checkbox"
            checked={exportVisible}
            onChange={(e) => setExportVisible(e.target.checked)}
          />
          <p>Only export visible medial axes</p>
        </label>

        <button
          style={{ alignSelf: "start" }}
          disabled={
            swaps[0].length === 0 &&
            swaps[1].length === 0 &&
            swaps[2].length === 0
          }
          onClick={() => {
            exportMAtoObj();
          }}
        >
          Export <code>.obj</code>
        </button>

        <div className="row">
          <button
            onClick={() => {
              downloadText(JSON.stringify(allSettings), "settings.json");
            }}
          >
            Export settings
          </button>
          <HoverTooltip right>
            Export the selected visualization, grid, and pruning settings to a{" "}
            <code>.json</code> file.
          </HoverTooltip>
        </div>

        <GridControls />

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
            style={{ flex: 1 }}
            disabled={workerRunning || !grid || !cplx}
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
            {workerRunning ? (
              <Loader $w0={20} $w1={60} />
            ) : (
              "Compute medial axes"
            )}
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
              <PruningParameters
                dim={dim}
                disabled={workerRunning || !grid || !cplx || !anySwaps}
              />
            </CollapseH4>
          ))}
        </div>

        <RenderOptions />
      </div>
    </div>
  );
};
