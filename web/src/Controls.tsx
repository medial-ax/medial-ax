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
  resetStateForNewComplexAtom,
  showGridAtom,
  showMAAtom,
  showObjectAtom,
  swapsAtom,
  swapsForMA,
  wireframeAtom,
  workerRunningAtom,
} from "./state";
import {
  ComponentProps,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { dualFaceQuad } from "./medialaxes";
import { downloadText, sum } from "./utils";
import styled from "styled-components";
import squished_cylinder from "../inputs/squished_cylinder.obj?raw";
import extruded_ellipse from "../inputs/extruded_ellipse.obj?raw";
import cube_subdiv_2 from "../inputs/cube-subdiv-2.obj?raw";
import maze_2 from "../inputs/maze_2.obj?raw";
import {
  VineyardsGrid,
  Index,
  VineyardsGridMesh,
  defaultVineyardsGrid,
} from "./types";
import {
  make_complex_from_obj,
  make_meshgrid_from_obj,
  split_grid,
} from "mars_wasm";
import { RESET } from "jotai/utils";
import { resetWasmWorker, run, makeWorker } from "./work";
import "./Controls.css";
import { HoverTooltip } from "./HoverTooltip";
import { toast } from "./Toast";

const EXAMPLE_OBJS = [
  { name: "Squished cylinder", string: squished_cylinder },
  { name: "Extruded ellipse", string: extruded_ellipse },
  { name: "Cube", string: cube_subdiv_2 },
  { name: "Maze", string: maze_2 },
];

const Input = ({
  onChange,
  onBlur,
  value,
  ...props
}: ComponentProps<"input">) => {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.value = String(value);
    }
  }, [value]);

  return (
    <input
      ref={ref}
      defaultValue={value}
      {...props}
      onChange={(e) => {
        if (!isNaN(parseFloat(e.target.value)) && e.target.value !== "")
          onChange?.(e);
      }}
      onBlur={(e) => {
        if (isNaN(parseFloat(e.target.value)) || e.target.value === "")
          e.target.value = String(value);
      }}
    />
  );
};

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

const MeshGridControls = ({ grid: _ }: { grid: VineyardsGridMesh }) => {
  return (
    <>
      <h3>Grid controls</h3>
      <span>Meshgrid has no options</span>
    </>
  );
};

const BasicGridControls = ({ grid }: { grid: VineyardsGrid }) => {
  const setGrid = useSetAtom(gridAtom);
  const [showGrid] = useAtom(showGridAtom);

  const cplx = useAtomValue(complexAtom);
  const [numDots, setNumDots] = useState(5);

  const exportGridToObj = useCallback((grid: VineyardsGrid) => {
    console.log({ grid });
    let obj = "o grid\n";

    const [x0, y0, z0] = grid.corner;
    const s = grid.size;
    const [X, Y, Z] = grid.shape;

    const coord2ind = new Map<string, number>();
    let ind = 1;
    for (let i = 0; i < X; i++) {
      for (let j = 0; j < Y; j++) {
        for (let k = 0; k < Z; k++) {
          obj += `v ${x0 + i * s} ${y0 + j * s} ${z0 + k * s}\n`;
          coord2ind.set(`${i}-${j}-${k}`, ind);
          ind++;
        }
      }
    }

    for (let i = 0; i < X; i++) {
      for (let j = 0; j < Y; j++) {
        for (let k = 0; k < Z; k++) {
          const us = coord2ind.get(`${i}-${j}-${k}` as const);
          if (us === undefined) throw new Error("should not be here us");

          if (i != X - 1) {
            const adj = coord2ind.get(`${i + 1}-${j}-${k}` as const);
            if (adj === undefined) throw new Error("should not be here x");
            obj += `l ${us} ${adj}\n`;
          }
          if (j != Y - 1) {
            const adj = coord2ind.get(`${i}-${j + 1}-${k}` as const);
            if (adj === undefined) throw new Error("should not be here y");
            obj += `l ${us} ${adj}\n`;
          }
          if (k != Z - 1) {
            const adj = coord2ind.get(`${i}-${j}-${k + 1}` as const);
            if (adj === undefined) throw new Error("should not be here z");
            obj += `l ${us} ${adj}\n`;
          }
        }
      }
    }

    downloadText(obj, "grid.obj");
  }, []);

  if (!grid || grid.type !== "grid")
    return (
      <>
        <h3>Grid controls</h3>
        <button
          disabled={!cplx}
          title={
            cplx
              ? undefined
              : "You need a complex before you can make the grid."
          }
          style={{ width: "fit-content", alignSelf: "center" }}
          onClick={() => {
            if (!cplx) return;
            setGrid(defaultVineyardsGrid(cplx.complex, numDots));
          }}
        >
          Make grid
        </button>
      </>
    );

  return (
    <>
      <h3>Grid controls</h3>
      <div className="row">
        <button
          disabled={!showGrid}
          style={{ width: "fit-content" }}
          onClick={() => {
            if (!cplx) return;
            setGrid(defaultVineyardsGrid(cplx.complex, numDots));
          }}
        >
          Reset grid
        </button>

        <button
          disabled={!showGrid}
          style={{ width: "fit-content" }}
          onClick={() => {
            exportGridToObj(grid);
          }}
        >
          Download grid
        </button>
      </div>

      <fieldset className="ranges-with-number">
        <p>Density</p>
        <input
          disabled={!showGrid}
          type="range"
          min={1}
          max={20}
          value={numDots}
          onChange={(e) => {
            const n = Number(e.target.value);
            setNumDots(n);
            setGrid(defaultVineyardsGrid(cplx!.complex, n));
          }}
        />
        <span>{numDots}</span>

        <p>Grid corner x</p>
        <input
          type="range"
          min={-2}
          max={2}
          step={0.01}
          value={grid.corner[0]}
          onChange={(e) => {
            const x = Number(e.target.value);
            setGrid({ ...grid, corner: [x, grid.corner[1], grid.corner[2]] });
          }}
          disabled={!showGrid}
        />
        <Input
          type="number"
          step={0.01}
          style={{ width: "5rem" }}
          value={grid.corner[0]}
          onChange={(e) => {
            const x = parseFloat(e.target.value);
            setGrid({ ...grid, corner: [x, grid.corner[1], grid.corner[2]] });
          }}
        />

        <p>Grid corner y</p>
        <input
          type="range"
          min={-2}
          max={2}
          step={0.01}
          value={grid.corner[1]}
          onChange={(e) => {
            const y = Number(e.target.value);
            setGrid({ ...grid, corner: [grid.corner[0], y, grid.corner[2]] });
          }}
          disabled={!showGrid}
        />
        <Input
          type="number"
          step={0.01}
          style={{ width: "5rem" }}
          value={grid.corner[1]}
          onChange={(e) => {
            const y = parseFloat(e.target.value);
            setGrid({ ...grid, corner: [grid.corner[0], y, grid.corner[2]] });
          }}
        />

        <p>Grid corner z</p>
        <input
          type="range"
          min={-2}
          max={2}
          step={0.01}
          value={grid.corner[2]}
          onChange={(e) => {
            const z = Number(e.target.value);
            setGrid({ ...grid, corner: [grid.corner[0], grid.corner[1], z] });
          }}
          disabled={!showGrid}
        />
        <Input
          type="number"
          step={0.01}
          style={{ width: "5rem" }}
          value={grid.corner[2]}
          onChange={(e) => {
            const z = parseFloat(e.target.value);
            setGrid({ ...grid, corner: [grid.corner[0], grid.corner[1], z] });
          }}
        />

        <p>Grid size</p>
        <input
          type="range"
          min={0.01}
          max={1}
          step={0.01}
          value={grid?.size}
          onChange={(e) => setGrid({ ...grid, size: Number(e.target.value) })}
          disabled={!showGrid}
        />
        <span>{grid.size.toFixed(3)}</span>
      </fieldset>

      <div className="row">
        <button
          onClick={() => {
            setGrid({
              ...grid,
              size: grid.size / 2,
              shape: [
                grid.shape[0] + grid.shape[0] - 1,
                grid.shape[1] + grid.shape[1] - 1,
                grid.shape[2] + grid.shape[2] - 1,
              ],
            });
          }}
          disabled={!showGrid}
        >
          Split grid
        </button>
        <button
          onClick={() => {
            setGrid({
              ...grid,
              size: grid.size * 2,
              shape: [
                Math.ceil(grid.shape[0] / 2),
                Math.ceil(grid.shape[1] / 2),
                Math.ceil(grid.shape[2] / 2),
              ],
            });
          }}
          disabled={!showGrid}
        >
          Merge grid
        </button>
      </div>

      <fieldset className="ranges-with-number">
        <p>Grid shape x</p>
        <input
          type="range"
          min={1}
          max={50}
          value={grid.shape[0]}
          onChange={(e) => {
            const x = Number(e.target.value);
            setGrid({ ...grid, shape: [x, grid.shape[1], grid.shape[2]] });
          }}
          disabled={!showGrid}
        />
        <p>{grid.shape[0]}</p>
        <p>Grid shape y</p>
        <input
          type="range"
          min={1}
          max={50}
          value={grid.shape[1]}
          onChange={(e) => {
            const y = Number(e.target.value);
            setGrid({ ...grid, shape: [grid.shape[0], y, grid.shape[2]] });
          }}
          disabled={!showGrid}
        />
        <p>{grid.shape[1]}</p>
        <p>Grid shape z</p>
        <input
          type="range"
          min={1}
          max={50}
          value={grid.shape[2]}
          onChange={(e) => {
            const z = Number(e.target.value);
            setGrid({ ...grid, shape: [grid.shape[0], grid.shape[1], z] });
          }}
          disabled={!showGrid}
        />
        <p>{grid.shape[2]}</p>
      </fieldset>
    </>
  );
};

const GridControls = () => {
  const grid = useAtomValue(gridAtom);
  const setGrid = useSetAtom(gridAtom);
  const cplx = useAtomValue(complexAtom);

  if (!grid)
    return (
      <>
        <h3>Grid controls</h3>
        <button
          disabled={!cplx}
          title={
            cplx
              ? undefined
              : "You need a complex before you can make the grid."
          }
          style={{ width: "fit-content", alignSelf: "center" }}
          onClick={() => {
            if (!cplx) return;
            setGrid(defaultVineyardsGrid(cplx.complex));
          }}
        >
          Make grid
        </button>
      </>
    );

  if (grid.type === "grid") return <BasicGridControls grid={grid} />;
  if (grid.type === "meshgrid") return <MeshGridControls grid={grid} />;
  return null;
};

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

const UploadObjFilePicker = () => {
  const setComplex = useSetAtom(complexAtom);
  const resetStateForNewComplex = useSetAtom(resetStateForNewComplexAtom);
  return (
    <label className="file">
      <p>
        Import <code>.obj</code>
      </p>
      <input
        type="file"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          f.text()
            .then((text) => {
              const value = make_complex_from_obj(text);
              resetStateForNewComplex();
              setComplex({ complex: value, filename: f.name });
            })
            .catch((err: string) => {
              toast("error", `Failed to parse .obj: ${err}`, 3);
            });
        }}
      />
    </label>
  );
};

const UploadMeshGridFilePicker = () => {
  const setGrid = useSetAtom(gridAtom);
  return (
    <label className="file">
      <p>
        Import grid from <code>.obj</code>
      </p>
      <input
        type="file"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          f.text()
            .then((text) => {
              const value = make_meshgrid_from_obj(text);
              setGrid({ type: "meshgrid", ...value });
              console.log(value);
            })
            .catch((err: string) => {
              toast("error", `Failed to parse .obj: ${err}`, 3);
            });
        }}
      />
    </label>
  );
};

const UploadStateFilePicker = () => {
  const grid = useAtomValue(gridAtom);
  const complex = useAtomValue(complexAtom);
  const allPruningParams = useAtomValue(allPruningParamsAtom);
  const [_, setSwaps] = useAtom(swapsAtom);
  const setGridForSwaps = useSetAtom(gridForSwapsAtom);

  return (
    <label className="file">
      <p>Import state from file</p>
      <input
        type="file"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const bytes = await f.arrayBuffer();
          console.log({ grid, complex });
          await run(
            "create-empty-state",
            {
              grid,
              complex: complex?.complex,
            },
            () => {},
          );

          await run(
            "load-state",
            {
              bytes,
              index: [0, 0, 0],
            },
            () => {},
          );

          const pruned: ExtractAtomValue<typeof swapsAtom> = {
            0: await run(
              "prune-dimension",
              {
                dim: 0,
                params: allPruningParams[0],
              },
              () => {},
            ),
            1: await run(
              "prune-dimension",
              {
                dim: 1,
                params: allPruningParams[1],
              },
              () => {},
            ),
            2: await run(
              "prune-dimension",
              {
                dim: 2,
                params: allPruningParams[2],
              },
              () => {},
            ),
          };

          setSwaps(pruned);
          setGridForSwaps(grid);
        }}
      />
    </label>
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
  const [cplx, setComplex] = useAtom(complexAtom);
  const [grid] = useAtom(gridAtom);
  const resetStateForNewComplex = useSetAtom(resetStateForNewComplexAtom);
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

        <ul className="predef-files-list">
          {EXAMPLE_OBJS.map((obj, i) => (
            <li
              key={i}
              onClick={() => {
                if (
                  (grid ||
                    (swaps[0].length !== 0 &&
                      swaps[1].length !== 0 &&
                      swaps[2].length !== 0)) &&
                  !window.confirm(
                    "Loading a new object will reset the grid and computed medial axes. Proceed?",
                  )
                )
                  return;
                const value = make_complex_from_obj(obj.string);
                resetStateForNewComplex();
                setComplex({
                  complex: value,
                  filename: obj.name.replace(" ", "-") + ".obj",
                });
                run("reset-state", {});
              }}
            >
              {obj.name}
            </li>
          ))}
        </ul>
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
