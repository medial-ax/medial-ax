import styled from "styled-components";
import "./App.css";
import { Canvas, MeshProps } from "@react-three/fiber";
import { Environment, OrbitControls, Wireframe } from "@react-three/drei";
import {
  Dispatch,
  SetStateAction,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { Barcode } from "./Barcode";
import { complex, timelinePositionAtom } from "./state";
import { selectedBirthDeathPair } from "./state";
import { keypointRadiusAtom, menuOpenAtom } from "./state";
import { colors } from "./constants";
import { Grid } from "./types";
import { dualFaceQuad, gridCoordinate } from "./medialaxes";
import init, {
  hello_from_rust,
  make_complex_from_obj,
  my_init_function,
  test_fn_1,
} from "ma-rs";
import { dedup } from "./utils";

await init().then(() => {
  my_init_function();
});

const CanvasContainer = styled.div`
  display: flex;
  width: 50%;
`;

const MenuContainer = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 100;
  display: flex;
  flex-direction: column;
  gap: 1rem;

  background: white;

  border-right: 1px solid #ccc;

  label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem;
    cursor: pointer;
  }

  label.file {
    flex-direction: column;
    align-items: start;
  }
`;

const Row = styled.div`
  display: flex;
  gap: 1rem;
  flex-direction: row;
  align-items: center;
`;

const Divider = () => {
  return (
    <div
      style={{
        width: "1px",
        height: "100%",
        background: "#ccc",
      }}
    />
  );
};

const UploadObjFilePicker = () => {
  const setComplex = useSetAtom(complex);
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

const Menu = ({
  setWireframe,
}: {
  setWireframe: Dispatch<SetStateAction<boolean>>;
}) => {
  const [keypointRadius, setKeypointRadius] = useAtom(keypointRadiusAtom);
  const [open, setOpen] = useAtom(menuOpenAtom);

  if (!open) {
    return (
      <div style={{ position: "absolute", top: 0, left: 0, zIndex: 123 }}>
        <button
          onClick={() => {
            setOpen(true);
          }}
        >
          Open menu
        </button>
      </div>
    );
  }

  return (
    <MenuContainer>
      <Row style={{ padding: "0 1rem" }}>
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
      <label>
        <p>Wireframe</p>
        <input
          type="checkbox"
          id="menu-toggle"
          onChange={(e) => setWireframe(e.target.checked)}
        />
      </label>

      <label>
        <p>Keypoint radius</p>
        <input
          type="range"
          min={0.01}
          max={0.5}
          step={0.001}
          value={keypointRadius}
          onChange={(e) => setKeypointRadius(Number(e.target.value))}
        />
      </label>

      <UploadObjFilePicker />
    </MenuContainer>
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
      <meshBasicMaterial
        side={THREE.DoubleSide}
        attach="material"
        color="#ff0000"
        transparent
        opacity={0.5}
      />
      <meshLambertMaterial
        color="#f3f3f3"
        flatShading
        side={THREE.DoubleSide}
      />
      {wireframe && <Wireframe />}
    </mesh>
  );
};

const RenderGrid = ({ grid, radius }: { grid: Grid; radius: number }) => {
  const meshref = useRef<THREE.InstancedMesh>(null);

  const points = useMemo(() => {
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
    if (!m) return;

    points.forEach((p, i) => {
      m.setMatrixAt(i, new THREE.Matrix4().makeTranslation(...p));
      m.instanceMatrix.needsUpdate = true;
    });
  }, [points]);

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

const RenderMedialAxis = ({ wireframe }: { wireframe?: boolean }) => {
  // const ref = useRef<THREE.BufferAttribute>(null);

  // const [coordBuffer, numberOfVertices] = useMemo(() => {
  //   let allCoords: number[] = [];
  //   for (const [p, q] of j.swaps) {
  //     const [a, b, c, d] = dualFaceQuad(j.grid, p, q);
  //     const vertexcoords = [...a, ...b, ...c, ...a, ...c, ...d];
  //     allCoords = allCoords.concat(vertexcoords);
  //   }
  //   return [new Float32Array(allCoords), j.swaps.length * 2 * 3];
  // }, [j.grid, j.swaps]);

  // useLayoutEffect(() => {
  //   if (!ref.current) return;
  //   ref.current.array = coordBuffer;
  //   ref.current.needsUpdate = true;
  // }, [coordBuffer]);

  return null;
  // return (
  //   <mesh>
  //     <bufferGeometry attach="geometry">
  //       <bufferAttribute
  //         ref={ref}
  //         attach="attributes-position"
  //         count={numberOfVertices}
  //         array={coordBuffer}
  //         itemSize={3}
  //       />
  //     </bufferGeometry>
  //     <meshBasicMaterial
  //       side={THREE.DoubleSide}
  //       attach="material"
  //       color="#ff0000"
  //       transparent
  //       opacity={0.5}
  //     />
  //     <meshLambertMaterial
  //       color={colors.blue}
  //       flatShading
  //       side={THREE.DoubleSide}
  //     />
  //     {wireframe && <Wireframe />}
  //   </mesh>
  // );
};

function App() {
  const cplx = useAtomValue(complex);

  const keypointRadius = useAtomValue(keypointRadiusAtom);

  const [wireframe, setWireframe] = useState(false);
  const [triangle, setTriangle] = useState<THREE.Vector3[] | undefined>(
    undefined
  );

  const bdPair = useAtomValue(selectedBirthDeathPair);
  const timelinePosition = useAtomValue(timelinePositionAtom);

  return (
    <Row style={{ width: "100%", alignItems: "stretch", gap: 0 }}>
      <Menu setWireframe={setWireframe} />
      <CanvasContainer id="canvas-container">
        <Canvas
          onPointerMissed={() => {
            setTriangle(undefined);
          }}
        >
          <OrbitControls
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
          />
          <color attach="background" args={["#f6f6f6"]} />

          <hemisphereLight
            color={"#ffffff"}
            groundColor="#333"
            intensity={3.0}
          />

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

          {/* <RenderMedialAxis j={json} wireframe={wireframe} />

              <RenderGrid grid={} radius={0.02} /> */}

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
      <Divider />

      <div style={{ display: "flex", width: "50%", background: "#e5e5e5" }}>
        {/*json && <Barcode json={json} /> */}
      </div>
    </Row>
  );
}

export default App;
