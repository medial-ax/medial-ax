import styled, { createGlobalStyle, css } from "styled-components";
import "./App.css";
import { Canvas, } from "@react-three/fiber";
import { Environment, OrbitControls, } from "@react-three/drei";
import { PropsWithChildren, useCallback, useRef, useState } from "react";
import * as THREE from "three";
import { SetStateAction, useAtom, useAtomValue, useSetAtom } from "jotai";
import { Barcode } from "./Barcode";
import {
  Dim,
  complexAtom,
  gridAtom,
  gridForSwapsAtom,
  gridRadiusAtom,
  pruningParamAtom,
  showGridAtom,
  showMAAtom,
  showObjectAtom,
  swapsAtom,
  swapsForMA,
  wireframeAtom,
  workerRunningAtom,
} from "./state";
import { keypointRadiusAtom, menuOpenAtom } from "./state";
import { colors } from "./constants";
import { dualFaceQuad, } from "./medialaxes";
import init, { make_complex_from_obj, my_init_function } from "ma-rs";
import { downloadText } from "./utils";
import squished_cylinder from "../inputs/squished_cylinder.obj?raw";
import extruded_ellipse from "../inputs/extruded_ellipse.obj?raw";
import cube_subdiv_2 from "../inputs/cube-subdiv-2.obj?raw";
import maze_2 from "../inputs/maze_2.obj?raw";
import { Grid } from "./types";
import { RESET } from "jotai/utils";
import MyWorker from './worker?worker';
import { RedEdge, RedSphere, RedTriangle, RenderComplex, RenderGrid, RenderMedialAxis } from "./Render";
import { createPortal } from "react-dom";
const myWorker = new MyWorker();

const GlobalStyle = createGlobalStyle`
  h1,h2,h3,h4,h5,h6, p {
    margin: 0;
    padding: 0;
    color: #333;
  }
  body {
    overflow: hidden;
  }

  input[type=range] {
    -webkit-appearance: none;
    margin: 0;
    cursor: pointer;
    height: calc(1.2rem + 6px);
    background: unset;
    width: 100%;

    &:disabled {
      opacity: 0.5;
    }
  }

  input[type=range]::-webkit-slider-runnable-track {
    width: 100%;
    height: 0.3rem;
    cursor: pointer;
    background: #888;
    border-radius: 4px;
  }

  input[type=range]::-webkit-slider-thumb {
    -webkit-appearance: none;
    margin-top: -0.45rem;
    height: 1.2rem;
    width: 0.35rem;
    background: unset;
    border: 1px solid #888;
    border-radius: 2px;
    cursor: pointer;
  }


  input[type=range]::-moz-range-track {
    height: 0.3rem;
    cursor: pointer;
    background: #888;
    border-radius: 4px;
  }

  input[type=range]::-moz-range-thumb {
    height: 1.2rem;
    width: 0.35rem;
    background: #ffffff;
    border: 1px solid #888;
    border-radius: 2px;
    cursor: pointer;
  }

  input[type=range]::-ms-track {
    height: 0.3rem;
    cursor: pointer;
    background: #888;
    border-radius: 4px;
  }
  input[type=range]::-ms-thumb {
    height: 1.2rem;
    width: 0.35rem;
    background: #ffffff;
    border: 1px solid #888;
    border-radius: 2px;
    cursor: pointer;
  }

  button {
    background: #f1f1f4;
    border-radius: 4px;
    border: 1px solid #aaaab8;

    font-size: 13px;
    padding: 3px 6px;
    line-height: 1.3;

    cursor: pointer;

    transition: background 0.1s ease-in-out;
    &:hover {
      background: #dadae2;
    }
    &:disabled {
      background: #f1f1f4;
      cursor: initial;
      opacity: 0.6;

    }
  }

  input[type="file"] {
    display: none;
  }
  
  label:has(input[type="file"]) {
    p {
      background: #f1f1f4;
      border-radius: 4px;
      border: 1px solid #aaaab8;

      font-size: 13px;
      padding: 3px 6px;
    line-height: 1.3;

      transition: background 0.1s ease-in-out;
      &:hover {
        background: #dadae2;
      }
      &:disabled {
        background: cyan;
      }
    }
  }
`;

const Loader = styled.span<{
  w0: number;
  w1: number;
}>`
  width: ${(p) => p.w0}px;
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
    width: ${(p) => p.w0}px;
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
      width: ${(p) => p.w0}px;
    }
    100% {
      width: ${(p) => p.w1}px;
    }
  }
`;

const ToggleBarcodeButton = styled.button`
  position: absolute;
  top: 0;
  right: 0;
  z-index: 10;
  margin: 0.6rem;
  text-overflow: wrap;
  width: 4rem;
`;

const EXAMPLE_OBJS = [
  { name: "Squished cylinder", string: squished_cylinder },
  { name: "Extruded ellipse", string: extruded_ellipse },
  { name: "Cube", string: cube_subdiv_2 },
  { name: "Maze", string: maze_2 },
];

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

await init().then(() => {
  my_init_function();
});

const MainContainer = styled.div`
  display: flex;
  flex-direction: row;
  width: 100vw;
  height: 100vh;
`;

const CanvasContainer = styled.div`
  display: flex;
  overflow-x: hidden;
  flex: 1;
`;

const OpenMenuButton = styled.button<{ open?: boolean }>`
  position: absolute;
  top: 0;
  left: 0;
  z-index: 10;
  margin: 0.6rem;
  max-width: 4rem;
  transform: ${(p) =>
    p.open ? "translateX(calc(-100% - 1.2rem))" : "translateX(0)"};
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

  label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;

    &:has(input:disabled) {
      p {
        opacity: 0.5;
        cursor: default;
      }
    }
  }

  label.file {
    flex-direction: column;
    align-items: start;
  }
`;

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

const BarcodeContainer = styled.div<{ open: boolean }>`
  display: flex;
  overflow: hidden;

  position: absolute;
  top: 2.8rem;
  right: 0;
  z-index: 100;
  margin: 0.6rem;
  width: fit-content;
  border: 1px solid #ccc;
  border-radius: 6px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.17);

  transform: ${(p) =>
    !p.open ? "translateX(calc(100% + 1.2rem))" : "translateX(0)"};
  transition: transform 0.2s ease-in-out;

  min-width: 30rem;
  min-height: 30rem;

  // background: ${colors.barcodeBackground};
  background: white;
`;

const Row = styled.div`
  display: flex;
  gap: 1rem;
  flex-direction: row;
  align-items: center;
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
    content: "${(p) => (p.open ? "🞃" : "🞂")}";
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

const HoverTooltipPopup = styled.span`
  position: fixed;
  bottom: 0;
  z-index: 100;
  max-width: 16rem;
  transform: translateX(-50%) translateY(-100%);
  height: fit-content;
  padding: 4px 8px;
  background: white;
  border-radius: 4px; 
  border: 1px solid #aaa;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.17);
  margin-top: -4px;
`;

const HoverTooltip = ({ children }: PropsWithChildren) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<undefined | { x: number, y: number }>(undefined);
  const ref = useRef<HTMLSpanElement>(null);

  return (
    <HoverTooltipSpan ref={ref} onMouseEnter={() => {
      if (!ref.current) return;
      setOpen(true);
      const { x, y } = ref.current.getBoundingClientRect();
      setPos({ x, y })
    }}
      onMouseLeave={() => {
        setOpen(false);
      }}

    >
      ?
      {open && pos &&
        createPortal(
          <HoverTooltipPopup style={{ top: pos.y, left: pos.x }}>
            {children}
          </HoverTooltipPopup>,
          document.body,
        )
      }
    </HoverTooltipSpan >
  );
}

const UploadObjFilePicker = () => {
  const setComplex = useSetAtom(complexAtom);
  return (
    <label className="file" htmlFor="file-upload">
      <p>
        Import <code>.obj</code>
      </p>
      <input
        type="file"
        id="file-upload"
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
        <p>Euclidean pruning <HoverTooltip>
          Prunes a Faustian swap if the simplices responsible for the swap
          are closer together than the pruning distance.
        </HoverTooltip></p>
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
          checked={params.coface}
          onChange={(e) => {
            set((c) => ({ ...c, coface: e.target.checked }));
          }}
        />
        <p>Coface pruning <HoverTooltip>
          Prunes a Faustian swap if the simplices responsible for the swap
          share a coface.
        </HoverTooltip></p>
      </label>

      <label>
        <input
          type="checkbox"
          checked={params.face}
          onChange={(e) => {
            set((c) => ({ ...c, face: e.target.checked }));
          }}
        />
        <p>Face pruning <HoverTooltip>
          Prunes a Faustian swap if the simplices responsible for the swap
          share a face.
        </HoverTooltip></p>
      </label>

      <label>
        <input
          type="checkbox"
          checked={params.persistence}
          onChange={(e) => {
            set((c) => ({ ...c, persistence: e.target.checked }));
          }}
        />
        <p>Persistence pruning <HoverTooltip>
          Prunes a Faustian swap if both of the simplices responsible for the swap
          are associated to a homology class with a lifespan shorter than the pruning lifespan.
        </HoverTooltip></p>
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

const Menu = () => {
  const [cplx, setComplex] = useAtom(complexAtom);
  const [grid, setGrid] = useAtom(gridAtom);
  const [swaps, setSwaps] = useAtom(swapsAtom);
  const [workerRunning, setWorkerRunning] = useAtom(workerRunningAtom);
  const setGridForSwaps = useSetAtom(gridForSwapsAtom);

  const [open, setOpen] = useAtom(menuOpenAtom);
  const shownMA = useAtomValue(showMAAtom);
  const [exportVisible, setExportVisible] = useState(true);

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
    <>
      <OpenMenuButton
        open={open}
        onClick={() => {
          setOpen(true);
        }}
      >
        Open menu
      </OpenMenuButton>
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
              myWorker.postMessage({
                grid,
                complex: cplx.complex,
              });
              myWorker.onmessage = (res: any) => {
                setWorkerRunning(false);

                const result = res.data;
                const withSwaps = result.filter((o: any) => o[2].v.length > 0);
                setSwaps(withSwaps);
                setGridForSwaps(grid);
              };
            }}
          >
            {workerRunning ? <Loader w0={20} w1={60} /> : "Compute medial axes"}
          </button>
        </Row>

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
    </>
  );
};

// const TransparentSphere = ({
//   pos,
//   radius = 0.05,
//   opacity = 1,
//   color = "#ff0000",
// }: {
//   pos: THREE.Vector3;
//   radius?: number;
//   opacity?: number;
//   color?: string;
// }) => {
//   return (
//     <mesh position={pos}>
//       {/* SphereGeometry(radius : Float, widthSegments : Integer, heightSegments : Integer, phiStart : Float, phiLength : Float, thetaStart : Float, thetaLength : Float) */}
//       <sphereGeometry args={[radius, 64, 32]} />
//       {/* <pointsMaterial color="#ff0000" /> */}
//       <meshBasicMaterial
//         attach="material"
//         color={color}
//         transparent
//         opacity={opacity}
//         depthWrite={false}
//       />
//     </mesh>
//   );
// };
//

const bboxFromComplex = (cplx: any) => {
  const [vertices] = cplx["simplices_per_dim"];
  const coords = vertices.map((v: any) => v.coords);
  const xs = coords.map((c: number[]) => c[0]);
  const ys = coords.map((c: number[]) => c[1]);
  const zs = coords.map((c: number[]) => c[2]);
  return [
    [Math.min(...xs), Math.min(...ys), Math.min(...zs)],
    [Math.max(...xs), Math.max(...ys), Math.max(...zs)],
  ];
};

const defaultGrid = (cplx: any, numberOfDots: number = 5) => {
  const bbox = bboxFromComplex(cplx);
  const scales = bbox[1].map((v, i) => v - bbox[0][i]);
  const scale = Math.min(...scales);
  const size = scale / (numberOfDots - 1);

  const shape = [
    Math.ceil(scales[0] / size) + 1,
    Math.ceil(scales[1] / size) + 1,
    Math.ceil(scales[2] / size) + 1,
  ];
  return {
    corner: bbox[0],
    size,
    shape,
  };
};

// export type Grid = {
//   corner: number[];
//   size: number;
//   shape: number[];
// };
const GridControls = () => {
  const [grid, _setGrid] = useAtom(gridAtom);
  const [showGrid, setShowGrid] = useAtom(showGridAtom);
  const [swaps, setSwaps] = useAtom(swapsAtom);

  const setGrid = useCallback(
    (f: SetStateAction<Grid | undefined>) => {
      // if (0 < swaps.length) {
      //   if (
      //     !window.confirm(
      //       "Changing the grid will delete the current medial axes. Proceed?",
      //     )
      //   )
      //     return;
      // }
      // setSwaps([]);
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
          title={cplx ? undefined : "You need a complex before you can make the grid."}
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

      <SliderGrid>
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
        <p>{numDots}</p>

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
        <p>{grid.corner[0].toFixed(3)}</p>

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
        <p>{grid.corner[1].toFixed(3)}</p>

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
        <p>{grid.corner[2].toFixed(3)}</p>

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
        <p>{grid.size.toFixed(3)}</p>
      </SliderGrid>

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

const RenderCanvas = () => {
  const cplx = useAtomValue(complexAtom);
  const wireframe = useAtomValue(wireframeAtom);
  const [triangle, setTriangle] = useState<THREE.Vector3[] | undefined>(
    undefined,
  );
  const showGrid = useAtomValue(showGridAtom);
  const grid = useAtomValue(gridAtom);
  const showObject = useAtomValue(showObjectAtom);
  const showMAs = useAtomValue(showMAAtom);
  const gridForSwaps = useAtomValue(gridForSwapsAtom);

  return (
    <CanvasContainer id="canvas-container">
      <Canvas
        onPointerMissed={() => {
          setTriangle(undefined);
        }}
      >
        <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} />
        <color attach="background" args={["#f6f6f6"]} />

        <hemisphereLight color={"#ffffff"} groundColor="#333" intensity={3.0} />

        {cplx && showObject && (
          <RenderComplex
            wireframe={wireframe}
            cplx={cplx.complex}
            key={cplx.filename}
            onClick={() => {
              // if (e.delta < 3) {
              //   const faceIndex = e.faceIndex;
              //   if (faceIndex === undefined) return;
              //   const face = json.triangles[faceIndex];
              //   const vertexIndices = [
              //     ...new Set(
              //       face.boundary.flatMap((ei) => json.edges[ei].boundary)
              //     ),
              //   ];
              //   if (vertexIndices) {
              //     setTriangle(
              //       vertexIndices.map(
              //         (v) => new THREE.Vector3(...json.vertices[v].coords!)
              //       )
              //     );
              //   }
              // }
            }}
          />
        )}

        {showGrid && <RenderGrid />}

        {gridForSwaps &&
          ([0, 1, 2] satisfies Dim[]).map((dim) => {
            if (showMAs[dim])
              return <RenderMedialAxis grid={gridForSwaps} dim={dim} key={dim} />;
            return null;
          })}

        {/* <RenderMedialAxis j={json} wireframe={wireframe} />


            {/* {bdPair && (
            <>
              {bdPair.birth && (
                <TransparentSphere
                  pos={new THREE.Vector3(...json.key_point)}
                  radius={Math.sqrt(bdPair.birth[0])}
                  color={colors.blue}
                  opacity={0.2}
                />
              )}
              {bdPair.death && (
                <TransparentSphere
                  pos={new THREE.Vector3(...json.key_point)}
                  radius={Math.sqrt(bdPair.death[0])}
                  color={colors.blue}
                  opacity={0.2}
                />
              )}
            </>
          )} */}

        {/* {timelinePosition && (
            <TransparentSphere
              pos={new THREE.Vector3(...json.key_point)}
              radius={Math.sqrt(timelinePosition)}
              opacity={0.2}
              color={colors.red}
            />
          )} */}

        {triangle && (
          <>
            <RedTriangle points={triangle} />
            <RedEdge from={triangle[0]} to={triangle[1]} radius={0.01} />
            <RedEdge from={triangle[1]} to={triangle[2]} radius={0.01} />
            <RedEdge from={triangle[2]} to={triangle[0]} radius={0.01} />
            <RedSphere pos={triangle[0]} radius={0.02} />
            <RedSphere pos={triangle[1]} radius={0.02} />
            <RedSphere pos={triangle[2]} radius={0.02} />
          </>
        )}

        <Environment preset="warehouse" />
        {/* <TorusKnot>
            {wireframe && <Wireframe />}
            <meshLambertMaterial attach="material" color="#f3f3f3" />
          </TorusKnot> */}
      </Canvas>
    </CanvasContainer>
  );
};

const RenderBarcodeSideThing = () => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <BarcodeContainer open={open}>
        <Barcode json={undefined} />
      </BarcodeContainer>
      <ToggleBarcodeButton
        onClick={() => {
          setOpen(!open);
        }}
      >
        {open ? "Hide" : "Show"} barcode
      </ToggleBarcodeButton>
    </>
  );
};

function App() {
  return (
    <>
      <GlobalStyle />
      <MainContainer>
        <Menu />
        <RenderCanvas />
        <RenderBarcodeSideThing />
      </MainContainer>
    </>
  );
}

export default App;
