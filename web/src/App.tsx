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
import { atom, useAtom, useAtomValue } from "jotai";
import { Barcode } from "./Barcode";

const keypointRadiusAtom = atom(0.02);

const menuOpenAtom = atom(true);

const CanvasContainer = styled.div`
  display: flex;
  flex: 1;
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

const UploadFileButton = ({ onJson }: { onJson: (j: Json) => void }) => {
  return (
    <label className="file" htmlFor="file-upload">
      <p>Upload JSON:</p>
      <input
        type="file"
        id="file-upload"
        onChange={(e) => {
          e.target.files?.[0]?.text().then((text) => {
            const j = JSON.parse(text) as Json;
            onJson(j);
          });
        }}
      />
    </label>
  );
};

const Menu = ({
  setWireframe,
  onJson,
}: {
  setWireframe: Dispatch<SetStateAction<boolean>>;
  onJson: (j: Json) => void;
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

      <UploadFileButton onJson={onJson} />
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

const RedTransparentSphere = ({
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

type Simplex = {
  id: number;
  coords: number[];
  boundary: number[];
};

type Permutation = {
  forwards: number[];
  backwards: number[];
};

export type BirthDeathPair = {
  dim: number;
  birth: [number, number] | null;
  death: [number, number] | null;
};

export const selectedBirthDeathPair = atom<BirthDeathPair | undefined>(
  undefined
);

export type Json = {
  vertices: Simplex[];
  edges: Simplex[];
  triangles: Simplex[];

  key_point: number[];

  vertex_ordering: Permutation;
  edge_ordering: Permutation;
  triangle_ordering: Permutation;

  empty_barcode: BirthDeathPair[];
  vertex_barcode: BirthDeathPair[];
  edge_barcode: BirthDeathPair[];
  triangle_barcode: BirthDeathPair[];
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
  json,
  wireframe,
  onClick,
}: {
  json: Json;
  wireframe?: boolean;
  onClick: MeshProps["onClick"];
}) => {
  const ref = useRef<THREE.BufferAttribute>(null);

  const getCoords = useCallback(() => {
    return json.triangles.flatMap((t) => {
      const vertices = new Set<number>();
      for (const edge_i of t.boundary)
        for (const vert_i of json.edges[edge_i].boundary) vertices.add(vert_i);

      const coords = Array.from(vertices).flatMap(
        (i: number) => json.vertices[i].coords
      );
      return coords;
    });
  }, [json]);

  const coords = useMemo(() => new Float32Array(getCoords()), [getCoords]);

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

function App() {
  const keypointRadius = useAtomValue(keypointRadiusAtom);

  const [wireframe, setWireframe] = useState(false);
  const [triangle, setTriangle] = useState<THREE.Vector3[] | undefined>(
    undefined
  );

  const [json, setJson] = useState<Json | undefined>(undefined);

  const onJson = useCallback((json: Json) => {
    setJson(json);
  }, []);

  const bdPair = useAtomValue(selectedBirthDeathPair);

  return (
    <Row style={{ width: "100%", alignItems: "stretch", gap: 0 }}>
      <Menu setWireframe={setWireframe} onJson={onJson} />
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
          {/* <color attach="background" args={["#f7f9fa"]} /> */}
          <color attach="background" args={["#f6f6f6"]} />

          <hemisphereLight
            color={"#ffffff"}
            groundColor="#333"
            intensity={3.0}
          />

          {/* <mesh
            ref={torus}
            onClick={(e) => }
          >
            <torusKnotGeometry args={[1, 0.3]} />
            <meshLambertMaterial color="#f3f3f3" flatShading />
            {wireframe && <Wireframe />}
          </mesh> */}
          {/* 
          {(new Array(10).fill(0) as number[]).map((_, i) => {
            const f = (Math.PI * 2 * i) / 10;
            return (
              <RedSphere
                key={i}
                pos={new THREE.Vector3(Math.sin(f), 0, Math.cos(f))}
              />
            );
          })} */}

          {json && (
            <>
              <RenderComplex
                json={json}
                wireframe={wireframe}
                onClick={(e) => {
                  if (e.delta < 3) {
                    const faceIndex = e.faceIndex;
                    if (faceIndex === undefined) return;
                    const face = json.triangles[faceIndex];
                    const vertexIndices = [
                      ...new Set(
                        face.boundary.flatMap((ei) => json.edges[ei].boundary)
                      ),
                    ];

                    if (vertexIndices) {
                      setTriangle(
                        vertexIndices.map(
                          (v) => new THREE.Vector3(...json.vertices[v].coords)
                        )
                      );
                    }
                  }
                }}
              />

              <RedSphere
                pos={new THREE.Vector3(...json.key_point)}
                radius={keypointRadius}
              />

              {bdPair && (
                <>
                  {bdPair.birth && (
                    <RedTransparentSphere
                      pos={new THREE.Vector3(...json.key_point)}
                      radius={Math.sqrt(bdPair.birth[0])}
                      color={"#00ff00"}
                      opacity={0.2}
                    />
                  )}
                  {bdPair.death && (
                    <RedTransparentSphere
                      pos={new THREE.Vector3(...json.key_point)}
                      radius={Math.sqrt(bdPair.death[0])}
                      opacity={0.2}
                    />
                  )}
                </>
              )}
            </>
          )}

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

      <div style={{ display: "flex", flex: 1, background: "#e5e5e5" }}>
        <Barcode json={json} />
      </div>
    </Row>
  );
}

export default App;
