import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  Dim,
  allPruningParamsAtom,
  allSettingsAtom,
  complexAtom,
  gridAtom,
  gridForSwapsAtom,
  gridRadiusAtom,
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
import {
  PropsWithChildren,
  SetStateAction,
  useCallback,
  useRef,
  useState,
} from "react";
import { dualFaceQuad } from "./medialaxes";
import { downloadText } from "./utils";
import styled, { CSSProperties, css } from "styled-components";
import squished_cylinder from "../inputs/squished_cylinder.obj?raw";
import extruded_ellipse from "../inputs/extruded_ellipse.obj?raw";
import cube_subdiv_2 from "../inputs/cube-subdiv-2.obj?raw";
import maze_2 from "../inputs/maze_2.obj?raw";
import { Grid, defaultGrid } from "./types";
import { createPortal } from "react-dom";
import { make_complex_from_obj } from "ma-rs";
import { RESET } from "jotai/utils";
import { resetWasmWorker, wasmWorker } from "./work";
import { CSS } from "./Controls.style";

const Wrapper = styled.div`
  ${CSS}
`;

const EXAMPLE_OBJS = [
  { name: "Squished cylinder", string: squished_cylinder },
  { name: "Extruded ellipse", string: extruded_ellipse },
  { name: "Cube", string: cube_subdiv_2 },
  { name: "Maze", string: maze_2 },
];

const SliderGrid = styled.div`
  display: grid;
  grid-template-columns: max-content auto minmax(2rem, max-content);
  gap: 0.5rem 1rem;
  justify-items: end;

  input[type="range"]:disabled,
  input[type="range"]:disabled + p,
  p:has(+ input[type="range"]:disabled) {
    opacity: 0.5;
  }
`;

const ExampleList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;

  border: 1px solid #ddd;
  margin: 0 1rem;
  padding: 0 !important;

  li {
    padding: 0.2rem 0.4rem;
    &:hover {
      background: #f3f3f3;
      cursor: pointer;
    }
  }
`;

const MenuContainer = styled.div`
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.17);
  padding-bottom: 1rem;

  z-index: 100;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  overflow-y: auto;
  max-width: fit-content;

  transition: transform 0.2s ease-in-out;

  background: white;

  border: 1px solid #ccc;
  border-radius: 6px;
  margin: 0.6rem;
  padding-top: 1rem;

  & > * {
    margin: 0 1rem;
  }
  & > h3 {
    margin: 0;
    padding: 0 1rem;
  }

  h3 {
    background: #e0e0e0;
  }
`;

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

const ClickableH4 = styled.h4<{ open: boolean }>`
  margin: 0 1rem;
  padding-left: 2px !important;
  border-bottom: 1px solid #ccc;

  &:hover {
    background: #f3f3f3;
    cursor: pointer;
  }

  &::before {
    content: "${(p) => (p.open ? "▼ " : "▶︎ ")}";
  }
`;

const CollapseDiv = styled.div<{ open: boolean }>`
  max-height: ${(p) =>
    p.open &&
    css`
      max-height: 0;
    `};
  transition: max-height 0.15s ease-in-out;
  overflow-y: hidden;
`;

const CtrlDiv = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  padding: 0;
  & > * {
    padding: 0 1rem;
  }
`;

const HoverTooltipSpan = styled.span`
  display: inline-block;
  padding: 2px;
  border-radius: 4px;
  border: 1px solid #888;
  height: 18px;
  box-sizing: border-box;
  vertical-align: super;
  line-height: 12px;
  font-size: 12px;
  font-weight: 600;
`;

const Row = styled.div`
  display: flex;
  gap: 1rem;
  flex-direction: row;
  align-items: center;
`;

const HoverTooltipPopup = styled.span<{ $right: boolean }>`
  position: fixed;
  bottom: 0;
  z-index: 100;
  max-width: 16rem;
  transform: translateX(${(p) => (p.$right ? "0" : "-50%")}) translateY(-100%);
  height: fit-content;
  padding: 4px 8px;
  background: white;
  border-radius: 4px;
  border: 1px solid #aaa;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.17);
  margin-top: -4px;
`;

const HoverTooltip = ({
  style,
  right,
  children,
}: PropsWithChildren<{ right?: boolean; style?: CSSProperties }>) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<undefined | { x: number; y: number }>(
    undefined,
  );
  const ref = useRef<HTMLSpanElement>(null);

  return (
    <HoverTooltipSpan
      style={style}
      ref={ref}
      onMouseEnter={() => {
        if (!ref.current) return;
        setOpen(true);
        const { x, y } = ref.current.getBoundingClientRect();
        setPos({ x, y });
      }}
      onMouseLeave={() => {
        setOpen(false);
      }}
    >
      ?
      {open &&
        pos &&
        createPortal(
          <HoverTooltipPopup
            style={{ top: pos.y, left: pos.x }}
            $right={right ?? false}
          >
            {children}
          </HoverTooltipPopup>,
          document.body,
        )}
    </HoverTooltipSpan>
  );
};

const GridControls = () => {
  const [grid, _setGrid] = useAtom(gridAtom);
  const [showGrid] = useAtom(showGridAtom);

  const setGrid = useCallback(
    (f: SetStateAction<Grid | undefined>) => {
      _setGrid(f);
    },
    [_setGrid],
  );

  const cplx = useAtomValue(complexAtom);
  const [numDots, setNumDots] = useState(7);

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
            setGrid(defaultGrid(cplx.complex));
          }}
        >
          Make grid
        </button>
      </>
    );

  return (
    <>
      <h3>Grid controls</h3>
      <button
        disabled={!showGrid}
        style={{ width: "fit-content", marginLeft: "1rem" }}
        onClick={() => {
          if (!cplx) return;
          setGrid(defaultGrid(cplx.complex));
        }}
      >
        Reset grid
      </button>

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
            setGrid(defaultGrid(cplx.complex, n));
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
        <span>{grid.corner[0].toFixed(3)}</span>

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
        <span>{grid.corner[1].toFixed(3)}</span>

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
        <span>{grid.corner[2].toFixed(3)}</span>

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

      <Row>
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
      </Row>

      <SliderGrid
        style={{
          alignItems: "initial | initial | right",
        }}
      >
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
      </SliderGrid>
    </>
  );
};

const CollapseH4 = ({
  title,
  children,
}: React.PropsWithChildren<{ title: string }>) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>(0);
  return (
    <>
      <ClickableH4
        open={open}
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
      </ClickableH4>
      <CollapseDiv
        open={open}
        ref={ref}
        style={{
          maxHeight: open ? (height ? height : "initial") : "0",
        }}
      >
        {children}
      </CollapseDiv>
    </>
  );
};

const UploadObjFilePicker = () => {
  const setComplex = useSetAtom(complexAtom);
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
          f.text().then((text) => {
            const value = make_complex_from_obj(text);
            setComplex({ complex: value, filename: f.name });
          });
        }}
      />
    </label>
  );
};

const PruningParameters = ({ dim }: { dim: Dim }) => {
  const [params, set] = useAtom(pruningParamAtom(dim));
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
      <SliderGrid>
        <p>Pruning distance</p>
        <input
          disabled={!params.euclidean}
          type="range"
          min={0}
          max={10}
          step={0.01}
          value={params.euclideanDistance ?? 0}
          onChange={(e) => {
            set((c) => ({ ...c, euclideanDistance: Number(e.target.value) }));
          }}
        />
        <p>{(params.euclideanDistance ?? 0.0).toFixed(2)}</p>
      </SliderGrid>

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
            Prunes a Faustian swap if the simplices responsible for the swap
            share a coface. Only for dimensions 0 and 1.
          </HoverTooltip>
        </p>
      </label>

      <label>
        <input
          type="checkbox"
          checked={params.face}
          onChange={(e) => {
            set((c) => ({ ...c, face: e.target.checked }));
          }}
        />
        <p>
          Face pruning{" "}
          <HoverTooltip>
            Prunes a Faustian swap if the simplices responsible for the swap
            share a face.
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
      <SliderGrid>
        <p>Pruning lifespan</p>
        <input
          disabled={!params.persistence}
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={params.persistenceThreshold ?? 0.01}
          onChange={(e) => {
            set((c) => ({
              ...c,
              persistenceThreshold: Number(e.target.value),
            }));
          }}
        />
        <p>{params.persistenceThreshold ?? 0.01}</p>
      </SliderGrid>

      <button
        style={{ alignSelf: "end", margin: "0 1rem" }}
        onClick={() => set(RESET)}
      >
        Reset
      </button>
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
      <SliderGrid>
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
      </SliderGrid>

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
  const [grid, setGrid] = useAtom(gridAtom);
  const [swaps, setSwaps] = useAtom(swapsAtom);
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

  const [allSettings, setAllSettings] = useAtom(allSettingsAtom);

  const exportMAtoObj = useCallback(() => {
    if (!grid) return;
    let obj = "";
    let v = 1;
    for (const ma of [0, 1, 2] satisfies Dim[]) {
      if (exportVisible && !shownMA[ma]) continue;
      obj += `o MA-${ma}\n`;
      for (const swap of swaps) {
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

    downloadText(obj, "medial-axes.obj");
  }, [exportVisible, grid, shownMA, swaps]);

  return (
    <Wrapper>
      <button
        id="open-menu-button"
        aria-hidden={!!open}
        onClick={() => {
          setOpen(true);
        }}
      >
        Open menu
      </button>
      <MenuContainer
        style={{
          transform: open
            ? "translateX(0)"
            : "translateX(calc(-100% - 1.2rem))",
        }}
      >
        <Row>
          <h2 style={{ flex: 1 }}>Controls</h2>
          <button
            style={{ justifySelf: "end" }}
            onClick={() => {
              setOpen(false);
            }}
          >
            Close
          </button>
        </Row>

        <h3>Import / Export</h3>
        <h4>Import</h4>
        <UploadObjFilePicker />
        <ExampleList>
          {EXAMPLE_OBJS.map((obj, i) => (
            <li
              key={i}
              onClick={() => {
                if (
                  (grid || swaps.length !== 0) &&
                  !window.confirm(
                    "Loading a new object will reset the grid and computed medial axes. Proceed?",
                  )
                )
                  return;
                const value = make_complex_from_obj(obj.string);
                setComplex({ complex: value, filename: obj.name });
                setSwaps([]);
                setGrid(undefined);
              }}
            >
              {obj.name}
            </li>
          ))}
        </ExampleList>
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

        <Row>
          <button
            disabled={swaps.length === 0}
            onClick={() => {
              exportMAtoObj();
            }}
          >
            Export <code>.obj</code>
          </button>
        </Row>

        <Row style={{ gap: "4px" }}>
          <button
            onClick={() => {
              downloadText(JSON.stringify(allSettings), "settings.json");
            }}
          >
            Export settings
          </button>
          <HoverTooltip style={{ alignSelf: "start" }} right>
            Export the selected visualization, grid, and pruning settings to a{" "}
            <code>.json</code> file.
          </HoverTooltip>
        </Row>

        <GridControls />

        <h3>Medial axes</h3>

        <Row>
          <button
            style={{ flex: 1 }}
            disabled={workerRunning}
            onClick={() => {
              if (!grid) {
                console.error("No grid!");
                return;
              }
              if (!cplx) {
                console.error("No complex!");
                return;
              }
              setWorkerRunning(true);
              wasmWorker.postMessage({
                fn: "run",
                args: {
                  grid,
                  complex: cplx.complex,
                  allPruningParams,
                },
              });
              wasmWorker.onmessage = (msg: any) => {
                if (msg.data.type === "progress") {
                  setWorkerProgress(msg.data.data);
                } else {
                  const res = msg.data.data;
                  setWorkerProgress(undefined);
                  setWorkerRunning(false);
                  const withSwaps = res.filter((o: any) => o[2].v.length > 0);
                  setSwaps(withSwaps);
                  setGridForSwaps(grid);
                }
              };
            }}
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
        </Row>
        {workerProgress && (
          <label>
            <p>{workerProgress.label}</p>
            {0 < workerProgress.n && (
              <progress value={workerProgress.i / workerProgress.n} />
            )}
            <p
              style={{
                width: "4ch",
                textAlign: "end",
              }}
            >
              {5 * Math.round((workerProgress.i / workerProgress.n) * 20)}%
            </p>
          </label>
        )}

        <CtrlDiv>
          {([0, 1, 2] satisfies Dim[]).map((dim) => (
            <CollapseH4 key={dim} title={`Pruning dim ${dim}`}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                  padding: "0.5rem 0",
                }}
              >
                <PruningParameters dim={dim} />
              </div>
            </CollapseH4>
          ))}
        </CtrlDiv>

        <RenderOptions />
      </MenuContainer>
    </Wrapper>
  );
};
