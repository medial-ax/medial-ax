import styled, { createGlobalStyle, css } from "styled-components";
import "./App.css";
import { Canvas, MeshProps } from "@react-three/fiber";
import { Environment, OrbitControls, Wireframe } from "@react-three/drei";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { Barcode } from "./Barcode";
import {
  Dim,
  complexAtom,
  gridAtom,
  gridRadiusAtom,
  pruningParamAtom,
  showGridAtom,
  showMA,
  swapsAtom,
  swapsForMA,
  wireframeAtom,
} from "./state";
import { keypointRadiusAtom, menuOpenAtom } from "./state";
import { colors } from "./constants";
import { dualFaceQuad, gridCoordinate } from "./medialaxes";
import init, { make_complex_from_obj, my_init_function, run } from "ma-rs";
import { dedup } from "./utils";
import squished_cylinder from "../inputs/squished_cylinder.obj?raw";
import extruded_ellipse from "../inputs/extruded_ellipse.obj?raw";
import cube_subdiv_2 from "../inputs/cube-subdiv-2.obj?raw";
import maze_2 from "../inputs/maze_2.obj?raw";
import { Grid } from "./types";
import { RESET } from "jotai/utils";

const GlobalStyle = createGlobalStyle`
  h1,h2,h3,h4,h5,h6, p {
    margin: 0;
    padding: 0;
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
  & > * {
    flex: 1;
  }
`;

const CanvasContainer = styled.div`
  display: flex;
  overflow-x: hidden;
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
    padding: 0 1rem;
  }

  h4 {
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

const ClickableH4 = styled.h4`
  &:hover {
    background: #d0d0d0;
    cursor: pointer;
  }
`;

const CollapseDiv = styled.div<{ open: boolean }>`
  max-height: ${p => p.open && css`max-height: 0;`};
  transition: max-height 0.15s ease-in-out;
  overflow-y: hidden;
`;

const CollapseH4 = ({ title, children }: React.PropsWithChildren<{ title: string }>) => {
  const [open, setOpen] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>(0);
  return <>
    <ClickableH4 onClick={() => {
      if (!ref.current) return;
      const { height } = ref.current.getBoundingClientRect();
      if (open) setHeight(Math.ceil(height));
      setTimeout(() => {
        setOpen(c => !c)
      }, 10);
    }}>{title}</ClickableH4>
    <CollapseDiv open={open} ref={ref} style={{
      maxHeight: open ? (height ? height : 'initial') : '0'
    }}>
      {children}
    </CollapseDiv>
  </>;
}

const CtrlDiv = styled.div`
  padding: 0;
  & > *  {
    padding: 0 1rem;
  }
`;

const UploadObjFilePicker = () => {
  const setComplex = useSetAtom(complexAtom);
  return (
    <label className="file" htmlFor="file-upload">
      <p>Upload OBJ:</p>
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
  return <>
    <label>
      <input type="checkbox"
        checked={params.euclidean}
        onChange={(e) => { set(c => ({ ...c, euclidean: e.target.checked })) }} />
      Euclidean pruning
    </label>
    <SliderGrid>
      <p>Pruning distance</p>
      <input
        disabled={!params.euclidean}
        type="range"
        min={0}
        max={10}
        step={0.1}
        value={params.euclideanDistance ?? 0}
        onChange={(e) => {
          set(c => ({ ...c, euclideanDistance: Number(e.target.value) }));
        }}
      />
      <p>{(params.euclideanDistance ?? 0.00).toFixed(2)}</p>
    </SliderGrid>

    <label>
      <input type="checkbox"
        checked={params.coface}
        onChange={(e) => { set(c => ({ ...c, coface: e.target.checked })) }} />
      Coface pruning
    </label>

    <label>
      <input type="checkbox"
        checked={params.face}
        onChange={(e) => { set(c => ({ ...c, face: e.target.checked })) }} />
      Face pruning
    </label>

    <label>
      <input type="checkbox"
        checked={params.persistence}
        onChange={(e) => { set(c => ({ ...c, persistence: e.target.checked })) }} />
      Persistence pruning
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
          set(c => ({ ...c, persistenceThreshold: Number(e.target.value) }));
        }}
      />
      <p>{params.persistenceThreshold ?? 0.01}</p>
    </SliderGrid>

    <button style={{ alignSelf: 'end', margin: '0 1rem' }} onClick={() => set(RESET)}>Reset</button>

  </>
}

const Menu = () => {
  const [cplx, setComplex] = useAtom(complexAtom);
  const [keypointRadius, setKeypointRadius] = useAtom(keypointRadiusAtom);
  const [gridRadius, setGridRadius] = useAtom(gridRadiusAtom);
  const [wireframe, setWireframe] = useAtom(wireframeAtom);
  const grid = useAtomValue(gridAtom);
  const setSwaps = useSetAtom(swapsAtom);
  const [showMa, setShowMa] = useAtom(showMA);

  const zerothMA = useAtomValue(swapsForMA(0));
  if (0 < zerothMA.length)
    console.log(zerothMA)

  const [open, setOpen] = useAtom(menuOpenAtom);

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
          <h3 style={{ flex: 1 }}>Controls</h3>
          <button
            style={{ justifySelf: "end" }}
            onClick={() => {
              setOpen(false);
            }}
          >
            Close
          </button>
        </Row>

        <button onClick={() => {
          if (!grid) { console.error('No grid!'); return; }
          if (!cplx) { console.error('No complex!'); return; }
          const result = run(grid, cplx.complex);
          const withSwaps = result.filter((o: any) => o[2].v.length > 0);
          setSwaps(withSwaps);
        }}>
          Debug
        </button>

        <h4>Example objs</h4>
        <ExampleList>
          {EXAMPLE_OBJS.map((obj, i) => (
            <li
              key={i}
              onClick={() => {
                const value = make_complex_from_obj(obj.string);
                setComplex({ complex: value, filename: obj.name });
              }}
            >
              {obj.name}
            </li>
          ))}
        </ExampleList>

        <UploadObjFilePicker />

        <GridControls />

        <h4>Render options</h4>
        <label>
          <p>Wireframe</p>
          <input
            type="checkbox"
            id="menu-toggle"
            checked={wireframe}
            onChange={(e) => setWireframe(e.target.checked)}
          />
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
          <label><input type="checkbox"
            onChange={(e) => { setShowMa((c) => ({ ...c, 0: e.target.checked })) }} disabled={zerothMA.length === 0} />Zeroth</label>
          <label><input type="checkbox" onChange={(e) => { setShowMa((c) => ({ ...c, 1: e.target.checked })) }} disabled={zerothMA.length === 0} />First TODO</label>
          <label><input type="checkbox" onChange={(e) => { setShowMa((c) => ({ ...c, 2: e.target.checked })) }} disabled={zerothMA.length === 0} />Second TODO</label>
        </fieldset>


        <CtrlDiv>
          {([0, 1, 2] satisfies Dim[]).map(dim => (
            <CollapseH4 key={dim} title={`Pruning dim ${dim}`}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.5rem 0' }}>
                <PruningParameters dim={dim} />
              </div>
            </CollapseH4 >
          ))
          }
        </CtrlDiv>


        {/* # CONTROL PARAMETERS
        medaxdim = 0  # can say example.medial_axis when set

        # euclidean prune: all dims
        euclid_prune = True
        prune_dist = 0.6

        # coboundary: dim 0,2
        cofaceprune = True

        # faceprune: dim 1,2
        faceprune = False

        # persistence prune: dim 1
        persprune = False
        persistence_threshold = 0.01
*/}
      </MenuContainer >
    </>
  );
};

const RedSphere = ({
  pos,
  radius = 0.05,
}: {
  pos: THREE.Vector3;
  radius?: number;
}) => {
  return (
    <mesh position={pos}>
      {/* SphereGeometry(radius : Float, widthSegments : Integer, heightSegments : Integer, phiStart : Float, phiLength : Float, thetaStart : Float, thetaLength : Float) */}
      <sphereGeometry args={[radius]} />
      {/* <pointsMaterial color="#ff0000" /> */}
      <meshLambertMaterial attach="material" color="#ff0000" />
    </mesh>
  );
};

const TransparentSphere = ({
  pos,
  radius = 0.05,
  opacity = 1,
  color = "#ff0000",
}: {
  pos: THREE.Vector3;
  radius?: number;
  opacity?: number;
  color?: string;
}) => {
  return (
    <mesh position={pos}>
      {/* SphereGeometry(radius : Float, widthSegments : Integer, heightSegments : Integer, phiStart : Float, phiLength : Float, thetaStart : Float, thetaLength : Float) */}
      <sphereGeometry args={[radius, 64, 32]} />
      {/* <pointsMaterial color="#ff0000" /> */}
      <meshBasicMaterial
        attach="material"
        color={color}
        transparent
        opacity={opacity}
        depthWrite={false}
      />
    </mesh>
  );
};

const RedEdge = ({
  from,
  to,
  radius = 0.03,
}: {
  from: THREE.Vector3;
  to: THREE.Vector3;
  radius?: number;
}) => {
  const len = from.distanceTo(to);
  const ref = useRef<THREE.Mesh>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;

    const middle = to.clone().add(from).multiplyScalar(0.5);
    ref.current.position.set(middle.x, middle.y, middle.z);

    ref.current.lookAt(to);
    ref.current.rotateOnAxis(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  }, [from, to]);

  return (
    <mesh position={from} ref={ref}>
      {/* SphereGeometry(radius : Float, widthSegments : Integer, heightSegments : Integer, phiStart : Float, phiLength : Float, thetaStart : Float, thetaLength : Float) */}
      <cylinderGeometry args={[radius, radius, len]} />
      {/* <pointsMaterial color="#ff0000" /> */}
      <meshLambertMaterial attach="material" color="#ff0000" />
    </mesh>
  );
};

const RedTriangle = ({ points }: { points: THREE.Vector3[] }) => {
  const ref = useRef<THREE.BufferAttribute>(null);

  useLayoutEffect(() => {
    if (!ref.current) return;
    ref.current.array = new Float32Array(
      points.flatMap((p) => [p.x, p.y, p.z])
    );
    ref.current.needsUpdate = true;
  }, [points]);

  return (
    <mesh>
      <bufferGeometry attach="geometry">
        <bufferAttribute
          ref={ref}
          attach="attributes-position"
          count={points.length}
          array={new Float32Array(points.flatMap((p) => [p.x, p.y, p.z]))}
          itemSize={3}
        />
      </bufferGeometry>
      <meshBasicMaterial
        side={THREE.DoubleSide}
        attach="material"
        color="#ff0000"
        transparent
        opacity={0.5}
      />
    </mesh>
  );
};

const RenderComplex = ({
  cplx,
  wireframe,
  onClick,
}: {
  cplx: any;
  wireframe?: boolean;
  onClick: MeshProps["onClick"];
}) => {
  const ref = useRef<THREE.BufferAttribute>(null);

  const getCoords = useCallback(() => {
    const [vertices, edges, triangles] = cplx["simplices_per_dim"];
    const out = triangles.flatMap((t: any) => {
      const vis: number[] = dedup(
        t["boundary"].map((ei: number) => edges[ei].boundary).flat()
      );
      const coords = vis.flatMap((i: number) => vertices[i].coords);
      return coords;
    });
    return new Float32Array(out);
  }, [cplx]);

  const coords = useMemo(() => getCoords(), [getCoords]);

  useLayoutEffect(() => {
    if (!ref.current) return;
    ref.current.array = new Float32Array(getCoords());
    ref.current.needsUpdate = true;
  }, [getCoords]);

  return (
    <mesh onClick={onClick}>
      <bufferGeometry attach="geometry">
        <bufferAttribute
          ref={ref}
          attach="attributes-position"
          count={coords.length / 3}
          array={coords}
          itemSize={3}
        />
      </bufferGeometry>
      {/* <meshBasicMaterial
        side={THREE.DoubleSide}
        attach="material"
        color="#ff0000"
        transparent
        opacity={0.5}
      /> */}
      <meshLambertMaterial
        color="#f3f3f3"
        flatShading
        side={THREE.DoubleSide}
      />
      {wireframe && <Wireframe />}
    </mesh>
  );
};

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

const defaultGrid = (cplx: any, numberOfDots: number = 10) => {
  const bbox = bboxFromComplex(cplx);
  const scales = bbox[1].map((v, i) => v - bbox[0][i]);
  const scale = Math.min(...scales);
  const size = scale / numberOfDots;

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
  const [grid, setGrid] = useAtom(gridAtom);
  const [showGrid, setShowGrid] = useAtom(showGridAtom);

  const cplx = useAtomValue(complexAtom);
  const [numDots, setNumDots] = useState(7);

  if (!grid)
    return (
      <>
        <h4>Grid controls</h4>
        <button
          disabled={!cplx}
          style={{ width: "fit-content", alignSelf: "center" }}
          onClick={() => {
            if (!cplx) return;
            setGrid(defaultGrid(cplx.complex, 7));
          }}
        >
          Make grid
        </button>
      </>
    );

  return (
    <>
      <h4>Grid controls</h4>
      <label>
        <p>Show grid</p>
        <input
          type="checkbox"
          checked={showGrid}
          onChange={(e) => {
            setShowGrid(e.target.checked);
          }}
        />
      </label>
      <button
        disabled={!showGrid}
        style={{ width: "fit-content", marginLeft: "1rem" }}
        onClick={() => {
          if (!cplx) return;
          setGrid(defaultGrid(cplx.complex, 7));
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
          Subdivide grid
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
          Undo
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

const RenderGrid = () => {
  const radius = useAtomValue(gridRadiusAtom);
  const grid = useAtomValue(gridAtom);
  const meshref = useRef<THREE.InstancedMesh>(null);

  const points = useMemo(() => {
    if (!grid) return;
    const coords: [number, number, number][] = [];
    for (let x = 0; x < grid.shape[0]; x++) {
      for (let y = 0; y < grid.shape[1]; y++) {
        for (let z = 0; z < grid.shape[2]; z++) {
          const c = gridCoordinate(grid, [x, y, z]);
          coords.push([c[0], c[1], c[2]]);
        }
      }
    }
    return coords;
  }, [grid]);

  useLayoutEffect(() => {
    const m = meshref.current;
    if (!m || !points) return;

    points.forEach((p, i) => {
      m.setMatrixAt(i, new THREE.Matrix4().makeTranslation(...p));
      m.instanceMatrix.needsUpdate = true;
    });
  }, [points]);

  if (!grid || !points) return null;

  return (
    <instancedMesh ref={meshref} args={[undefined, undefined, points.length]}>
      <boxGeometry args={[radius, radius, radius]} />
      <meshBasicMaterial
        side={THREE.DoubleSide}
        attach="material"
        color="#ff0000"
        transparent
        opacity={0.25}
      />
    </instancedMesh>
  );
};

const RenderMedialAxis = ({ grid, dim, wireframe }: { grid: Grid, dim: Dim, wireframe?: boolean }) => {
  const swaps = useAtomValue(swapsForMA(dim));
  const ref = useRef<THREE.BufferAttribute>(null);

  const [coordBuffer, numberOfVertices] = useMemo(() => {
    let allCoords: number[] = [];
    for (const [p, q] of swaps) {
      const [a, b, c, d] = dualFaceQuad(grid, p, q);
      const vertexcoords = [...a, ...b, ...c, ...a, ...c, ...d];
      allCoords = allCoords.concat(vertexcoords);
    }
    return [new Float32Array(allCoords), swaps.length * 2 * 3];
  }, [grid, swaps]);

  useLayoutEffect(() => {
    if (!ref.current) return;
    ref.current.array = coordBuffer;
    ref.current.needsUpdate = true;
  }, [coordBuffer]);

  if (numberOfVertices === 0) return null;

  return (
    <mesh key={numberOfVertices}>
      <bufferGeometry attach="geometry">
        <bufferAttribute
          ref={ref}
          attach="attributes-position"
          count={numberOfVertices}
          array={coordBuffer}
          itemSize={3}
        />
      </bufferGeometry>
      <meshBasicMaterial
        side={THREE.DoubleSide}
        attach="material"
        color="#ff0000"
        transparent
        opacity={0.5}
      />
      <meshLambertMaterial
        color={colors.blue}
        flatShading
        side={THREE.DoubleSide}
      />
      {wireframe && <Wireframe />}
    </mesh>
  );
};

const RenderCanvas = () => {
  const cplx = useAtomValue(complexAtom);
  const wireframe = useAtomValue(wireframeAtom);
  const [triangle, setTriangle] = useState<THREE.Vector3[] | undefined>(
    undefined
  );
  const showGrid = useAtomValue(showGridAtom);
  const grid = useAtomValue(gridAtom);

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

        {/* {json.swaps.map(([p, q]) => {
                const pa = gridCoordinate(json.grid, p);
                const pb = gridCoordinate(json.grid, q);
                return (
                  <>
                    <RedSphere
                      pos={new THREE.Vector3(pa[0], pa[1], pa[2])}
                      radius={0.02}
                    />
                    <RedSphere
                      pos={new THREE.Vector3(pb[0], pb[1], pb[2])}
                      radius={0.02}
                    />
                    <RedEdge
                      from={new THREE.Vector3(pa[0], pa[1], pa[2])}
                      to={new THREE.Vector3(pb[0], pb[1], pb[2])}
                    />
                  </>
                );
              })} */}
        {cplx && (
          <RenderComplex
            wireframe={wireframe}
            cplx={cplx.complex}
            key={cplx.filename}
            onClick={(e) => {
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

        {grid && <RenderMedialAxis grid={grid} dim={0} />}

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
