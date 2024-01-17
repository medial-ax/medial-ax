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
import { timelinePositionAtom } from "./state";

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
  coords: number[] | null;
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
        (i: number) => json.vertices[i].coords!
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

const getDefaultJson = (): Json => {
  return {
    vertices: [
      { id: 0, coords: [0.570985, 1.963441, 0.285934], boundary: [0] },
      { id: 1, coords: [0.194519, -1.995791, 0.285934], boundary: [0] },
      { id: 2, coords: [2.198826, 1.360582, 0.285934], boundary: [0] },
      { id: 3, coords: [-2.227396, -1.339769, 0.285934], boundary: [0] },
      { id: 4, coords: [1.573552, 1.7028, 0.285934], boundary: [0] },
      { id: 5, coords: [1.238429, -1.821635, 0.285934], boundary: [0] },
      { id: 6, coords: [2.373656, 1.223066, 0.285934], boundary: [0] },
      { id: 7, coords: [-0.236729, 1.993764, 0.285934], boundary: [0] },
      { id: 8, coords: [2.911405, -0.482457, 0.285934], boundary: [0] },
      { id: 9, coords: [2.868353, 0.585967, 0.285934], boundary: [0] },
      { id: 10, coords: [-2.632729, 0.958874, 0.285934], boundary: [0] },
      { id: 11, coords: [-1.12926, -1.852898, 0.285934], boundary: [0] },
      { id: 12, coords: [-0.874418, -1.913158, 0.285934], boundary: [0] },
      { id: 13, coords: [-2.984127, -0.205464, 0.285934], boundary: [0] },
      { id: 14, coords: [2.122995, -1.413096, 0.285934], boundary: [0] },
      { id: 15, coords: [2.979483, 0.233506, 0.285934], boundary: [0] },
      { id: 16, coords: [1.47943, -1.739896, 0.285934], boundary: [0] },
      { id: 17, coords: [-1.27685, 1.809807, 0.285934], boundary: [0] },
      { id: 18, coords: [-1.830848, -1.584367, 0.285934], boundary: [0] },
      { id: 19, coords: [-2.991015, 0.15467, 0.285934], boundary: [0] },
      { id: 20, coords: [1.089942, 1.863334, 0.285934], boundary: [0] },
      { id: 21, coords: [0.033512, 1.999875, 0.285934], boundary: [0] },
      { id: 22, coords: [2.77756, 0.755766, 0.285934], boundary: [0] },
      { id: 23, coords: [-0.769263, 1.93313, 0.285934], boundary: [0] },
      { id: 24, coords: [-2.957976, 0.333584, 0.285934], boundary: [0] },
      { id: 25, coords: [-2.551711, -1.051723, 0.285934], boundary: [0] },
      { id: 26, coords: [-2.944256, -0.383758, 0.285934], boundary: [0] },
      { id: 27, coords: [2.468729, -1.136344, 0.285934], boundary: [0] },
      { id: 28, coords: [0.303481, 1.98974, 0.285934], boundary: [0] },
      { id: 29, coords: [2.664204, 0.919425, 0.285934], boundary: [0] },
      { id: 30, coords: [2.529203, 1.075615, 0.285934], boundary: [0] },
      { id: 31, coords: [-1.374927, -1.777586, 0.285934], boundary: [0] },
      { id: 32, coords: [0.987366, -1.888575, 0.285934], boundary: [0] },
      { id: 33, coords: [-2.152684, 1.392991, 0.285934], boundary: [0] },
      { id: 34, coords: [2.006133, 1.487045, 0.285934], boundary: [0] },
      { id: 35, coords: [-2.332079, 1.258113, 0.285934], boundary: [0] },
      { id: 36, coords: [2.935843, 0.411408, 0.285934], boundary: [0] },
      { id: 37, coords: [-0.345553, -1.986688, 0.285934], boundary: [0] },
      { id: 38, coords: [2.96474, -0.305734, 0.285934], boundary: [0] },
      { id: 39, coords: [-2.900907, 0.509788, 0.285934], boundary: [0] },
      { id: 40, coords: [-1.609425, -1.687832, 0.285934], boundary: [0] },
      { id: 41, coords: [1.923517, -1.534794, 0.285934], boundary: [0] },
      { id: 42, coords: [-1.027229, 1.879102, 0.285934], boundary: [0] },
      { id: 43, coords: [-0.612473, -1.957876, 0.285934], boundary: [0] },
      { id: 44, coords: [-2.683393, -0.894279, 0.285934], boundary: [0] },
      { id: 45, coords: [0.463283, -1.976008, 0.285934], boundary: [0] },
      { id: 46, coords: [-2.820271, 0.68185, 0.285934], boundary: [0] },
      { id: 47, coords: [2.612178, -0.983537, 0.285934], boundary: [0] },
      { id: 48, coords: [2.834418, -0.65526, 0.285934], boundary: [0] },
      { id: 49, coords: [2.998918, 0.053708, 0.285934], boundary: [0] },
      { id: 50, coords: [0.728283, -1.940172, 0.285934], boundary: [0] },
      { id: 51, coords: [2.305226, -1.279919, 0.285934], boundary: [0] },
      { id: 52, coords: [-2.037398, -1.468031, 0.285934], boundary: [0] },
      { id: 53, coords: [1.797142, 1.601427, 0.285934], boundary: [0] },
      { id: 54, coords: [-2.999756, -0.0255, 0.285934], boundary: [0] },
      { id: 55, coords: [2.734405, -0.822741, 0.285934], boundary: [0] },
      { id: 56, coords: [-2.880466, -0.558934, 0.285934], boundary: [0] },
      { id: 57, coords: [-0.505048, 1.971455, 0.285934], boundary: [0] },
      { id: 58, coords: [1.708413, -1.644023, 0.285934], boundary: [0] },
      { id: 59, coords: [-1.890851, 1.55273, 0.285934], boundary: [0] },
      { id: 60, coords: [-2.492528, 1.113015, 0.285934], boundary: [0] },
      { id: 61, coords: [0.83385, 1.921191, 0.285934], boundary: [0] },
      { id: 62, coords: [-2.399299, -1.200623, 0.285934], boundary: [0] },
      { id: 63, coords: [-0.075825, -1.999361, 0.285934], boundary: [0] },
      { id: 64, coords: [2.993991, -0.126527, 0.285934], boundary: [0] },
      { id: 65, coords: [-1.673457, 1.659925, 0.285934], boundary: [0] },
      { id: 66, coords: [-2.793275, -0.72957, 0.285934], boundary: [0] },
      { id: 67, coords: [1.337178, 1.790339, 0.285934], boundary: [0] },
      { id: 68, coords: [0.570985, 1.963441, 0.004464], boundary: [0] },
      { id: 69, coords: [0.194519, -1.995791, 0.004464], boundary: [0] },
      { id: 70, coords: [2.198826, 1.360582, 0.004464], boundary: [0] },
      { id: 71, coords: [-2.227396, -1.339769, 0.004464], boundary: [0] },
      { id: 72, coords: [1.573552, 1.7028, 0.004464], boundary: [0] },
      { id: 73, coords: [1.238429, -1.821635, 0.004464], boundary: [0] },
      { id: 74, coords: [2.373656, 1.223066, 0.004464], boundary: [0] },
      { id: 75, coords: [-0.236729, 1.993764, 0.004464], boundary: [0] },
      { id: 76, coords: [2.911405, -0.482457, 0.004464], boundary: [0] },
      { id: 77, coords: [2.868353, 0.585967, 0.004464], boundary: [0] },
      { id: 78, coords: [-2.632729, 0.958874, 0.004464], boundary: [0] },
      { id: 79, coords: [-1.12926, -1.852898, 0.004464], boundary: [0] },
      { id: 80, coords: [-0.874418, -1.913158, 0.004464], boundary: [0] },
      { id: 81, coords: [-2.984127, -0.205464, 0.004464], boundary: [0] },
      { id: 82, coords: [2.122995, -1.413096, 0.004464], boundary: [0] },
      { id: 83, coords: [2.979483, 0.233506, 0.004464], boundary: [0] },
      { id: 84, coords: [1.47943, -1.739896, 0.004464], boundary: [0] },
      { id: 85, coords: [-1.27685, 1.809807, 0.004464], boundary: [0] },
      { id: 86, coords: [-1.830848, -1.584367, 0.004464], boundary: [0] },
      { id: 87, coords: [-2.991015, 0.15467, 0.004464], boundary: [0] },
      { id: 88, coords: [1.089942, 1.863334, 0.004464], boundary: [0] },
      { id: 89, coords: [0.033512, 1.999875, 0.004464], boundary: [0] },
      { id: 90, coords: [2.77756, 0.755766, 0.004464], boundary: [0] },
      { id: 91, coords: [-0.769263, 1.93313, 0.004464], boundary: [0] },
      { id: 92, coords: [-2.957976, 0.333584, 0.004464], boundary: [0] },
      { id: 93, coords: [-2.551711, -1.051723, 0.004464], boundary: [0] },
      { id: 94, coords: [-2.944256, -0.383758, 0.004464], boundary: [0] },
      { id: 95, coords: [2.468729, -1.136344, 0.004464], boundary: [0] },
      { id: 96, coords: [0.303481, 1.98974, 0.004464], boundary: [0] },
      { id: 97, coords: [2.664204, 0.919425, 0.004464], boundary: [0] },
      { id: 98, coords: [2.529203, 1.075615, 0.004464], boundary: [0] },
      { id: 99, coords: [-1.374927, -1.777586, 0.004464], boundary: [0] },
      { id: 100, coords: [0.987366, -1.888575, 0.004464], boundary: [0] },
      { id: 101, coords: [-2.152684, 1.392991, 0.004464], boundary: [0] },
      { id: 102, coords: [2.006133, 1.487045, 0.004464], boundary: [0] },
      { id: 103, coords: [-2.332079, 1.258113, 0.004464], boundary: [0] },
      { id: 104, coords: [2.935843, 0.411408, 0.004464], boundary: [0] },
      { id: 105, coords: [-0.345553, -1.986688, 0.004464], boundary: [0] },
      { id: 106, coords: [2.96474, -0.305734, 0.004464], boundary: [0] },
      { id: 107, coords: [-2.900907, 0.509788, 0.004464], boundary: [0] },
      { id: 108, coords: [-1.609425, -1.687832, 0.004464], boundary: [0] },
      { id: 109, coords: [1.923517, -1.534794, 0.004464], boundary: [0] },
      { id: 110, coords: [-1.027229, 1.879102, 0.004464], boundary: [0] },
      { id: 111, coords: [-0.612473, -1.957876, 0.004464], boundary: [0] },
      { id: 112, coords: [-2.683393, -0.894279, 0.004464], boundary: [0] },
      { id: 113, coords: [0.463283, -1.976008, 0.004464], boundary: [0] },
      { id: 114, coords: [-2.820271, 0.68185, 0.004464], boundary: [0] },
      { id: 115, coords: [2.612178, -0.983537, 0.004464], boundary: [0] },
      { id: 116, coords: [2.834418, -0.65526, 0.004464], boundary: [0] },
      { id: 117, coords: [2.998918, 0.053708, 0.004464], boundary: [0] },
      { id: 118, coords: [0.728283, -1.940172, 0.004464], boundary: [0] },
      { id: 119, coords: [2.305226, -1.279919, 0.004464], boundary: [0] },
      { id: 120, coords: [-2.037398, -1.468031, 0.004464], boundary: [0] },
      { id: 121, coords: [1.797142, 1.601427, 0.004464], boundary: [0] },
      { id: 122, coords: [-2.999756, -0.0255, 0.004464], boundary: [0] },
      { id: 123, coords: [2.734405, -0.822741, 0.004464], boundary: [0] },
      { id: 124, coords: [-2.880466, -0.558934, 0.004464], boundary: [0] },
      { id: 125, coords: [-0.505048, 1.971455, 0.004464], boundary: [0] },
      { id: 126, coords: [1.708413, -1.644023, 0.004464], boundary: [0] },
      { id: 127, coords: [-1.890851, 1.55273, 0.004464], boundary: [0] },
      { id: 128, coords: [-2.492528, 1.113015, 0.004464], boundary: [0] },
      { id: 129, coords: [0.83385, 1.921191, 0.004464], boundary: [0] },
      { id: 130, coords: [-2.399299, -1.200623, 0.004464], boundary: [0] },
      { id: 131, coords: [-0.075825, -1.999361, 0.004464], boundary: [0] },
      { id: 132, coords: [2.993991, -0.126527, 0.004464], boundary: [0] },
      { id: 133, coords: [-1.673457, 1.659925, 0.004464], boundary: [0] },
      { id: 134, coords: [-2.793275, -0.72957, 0.004464], boundary: [0] },
      { id: 135, coords: [1.337178, 1.790339, 0.004464], boundary: [0] },
    ],
    edges: [
      { id: 0, coords: null, boundary: [1, 131] },
      { id: 1, coords: null, boundary: [63, 131] },
      { id: 2, coords: null, boundary: [1, 63] },
      { id: 3, coords: null, boundary: [43, 80] },
      { id: 4, coords: null, boundary: [12, 80] },
      { id: 5, coords: null, boundary: [12, 43] },
      { id: 6, coords: null, boundary: [9, 104] },
      { id: 7, coords: null, boundary: [36, 104] },
      { id: 8, coords: null, boundary: [9, 36] },
      { id: 9, coords: null, boundary: [49, 132] },
      { id: 10, coords: null, boundary: [64, 132] },
      { id: 11, coords: null, boundary: [49, 64] },
      { id: 12, coords: null, boundary: [8, 116] },
      { id: 13, coords: null, boundary: [48, 116] },
      { id: 14, coords: null, boundary: [8, 48] },
      { id: 15, coords: null, boundary: [67, 72] },
      { id: 16, coords: null, boundary: [4, 72] },
      { id: 17, coords: null, boundary: [4, 67] },
      { id: 18, coords: null, boundary: [26, 81] },
      { id: 19, coords: null, boundary: [13, 81] },
      { id: 20, coords: null, boundary: [13, 26] },
      { id: 21, coords: null, boundary: [39, 114] },
      { id: 22, coords: null, boundary: [46, 114] },
      { id: 23, coords: null, boundary: [39, 46] },
      { id: 24, coords: null, boundary: [34, 70] },
      { id: 25, coords: null, boundary: [2, 70] },
      { id: 26, coords: null, boundary: [2, 34] },
      { id: 27, coords: null, boundary: [63, 105] },
      { id: 28, coords: null, boundary: [37, 105] },
      { id: 29, coords: null, boundary: [37, 63] },
      { id: 30, coords: null, boundary: [0, 129] },
      { id: 31, coords: null, boundary: [61, 129] },
      { id: 32, coords: null, boundary: [0, 61] },
      { id: 33, coords: null, boundary: [16, 73] },
      { id: 34, coords: null, boundary: [5, 73] },
      { id: 35, coords: null, boundary: [5, 16] },
      { id: 36, coords: null, boundary: [57, 75] },
      { id: 37, coords: null, boundary: [7, 75] },
      { id: 38, coords: null, boundary: [7, 57] },
      { id: 39, coords: null, boundary: [40, 86] },
      { id: 40, coords: null, boundary: [18, 86] },
      { id: 41, coords: null, boundary: [18, 40] },
      { id: 42, coords: null, boundary: [12, 79] },
      { id: 43, coords: null, boundary: [11, 79] },
      { id: 44, coords: null, boundary: [11, 12] },
      { id: 45, coords: null, boundary: [47, 95] },
      { id: 46, coords: null, boundary: [27, 95] },
      { id: 47, coords: null, boundary: [27, 47] },
      { id: 48, coords: null, boundary: [50, 113] },
      { id: 49, coords: null, boundary: [45, 113] },
      { id: 50, coords: null, boundary: [45, 50] },
      { id: 51, coords: null, boundary: [61, 88] },
      { id: 52, coords: null, boundary: [20, 88] },
      { id: 53, coords: null, boundary: [20, 61] },
      { id: 54, coords: null, boundary: [14, 109] },
      { id: 55, coords: null, boundary: [41, 109] },
      { id: 56, coords: null, boundary: [14, 41] },
      { id: 57, coords: null, boundary: [23, 125] },
      { id: 58, coords: null, boundary: [57, 125] },
      { id: 59, coords: null, boundary: [23, 57] },
      { id: 60, coords: null, boundary: [21, 96] },
      { id: 61, coords: null, boundary: [28, 96] },
      { id: 62, coords: null, boundary: [21, 28] },
      { id: 63, coords: null, boundary: [19, 92] },
      { id: 64, coords: null, boundary: [24, 92] },
      { id: 65, coords: null, boundary: [19, 24] },
      { id: 66, coords: null, boundary: [30, 97] },
      { id: 67, coords: null, boundary: [29, 97] },
      { id: 68, coords: null, boundary: [29, 30] },
      { id: 69, coords: null, boundary: [3, 130] },
      { id: 70, coords: null, boundary: [62, 130] },
      { id: 71, coords: null, boundary: [3, 62] },
      { id: 72, coords: null, boundary: [60, 103] },
      { id: 73, coords: null, boundary: [35, 103] },
      { id: 74, coords: null, boundary: [35, 60] },
      { id: 75, coords: null, boundary: [65, 85] },
      { id: 76, coords: null, boundary: [17, 85] },
      { id: 77, coords: null, boundary: [17, 65] },
      { id: 78, coords: null, boundary: [24, 107] },
      { id: 79, coords: null, boundary: [39, 107] },
      { id: 80, coords: null, boundary: [24, 39] },
      { id: 81, coords: null, boundary: [44, 134] },
      { id: 82, coords: null, boundary: [66, 134] },
      { id: 83, coords: null, boundary: [44, 66] },
      { id: 84, coords: null, boundary: [17, 110] },
      { id: 85, coords: null, boundary: [42, 110] },
      { id: 86, coords: null, boundary: [17, 42] },
      { id: 87, coords: null, boundary: [27, 119] },
      { id: 88, coords: null, boundary: [51, 119] },
      { id: 89, coords: null, boundary: [27, 51] },
      { id: 90, coords: null, boundary: [48, 123] },
      { id: 91, coords: null, boundary: [55, 123] },
      { id: 92, coords: null, boundary: [48, 55] },
      { id: 93, coords: null, boundary: [10, 128] },
      { id: 94, coords: null, boundary: [60, 128] },
      { id: 95, coords: null, boundary: [10, 60] },
      { id: 96, coords: null, boundary: [64, 106] },
      { id: 97, coords: null, boundary: [38, 106] },
      { id: 98, coords: null, boundary: [38, 64] },
      { id: 99, coords: null, boundary: [36, 83] },
      { id: 100, coords: null, boundary: [15, 83] },
      { id: 101, coords: null, boundary: [15, 36] },
      { id: 102, coords: null, boundary: [13, 122] },
      { id: 103, coords: null, boundary: [54, 122] },
      { id: 104, coords: null, boundary: [13, 54] },
      { id: 105, coords: null, boundary: [29, 90] },
      { id: 106, coords: null, boundary: [22, 90] },
      { id: 107, coords: null, boundary: [22, 29] },
      { id: 108, coords: null, boundary: [2, 74] },
      { id: 109, coords: null, boundary: [6, 74] },
      { id: 110, coords: null, boundary: [2, 6] },
      { id: 111, coords: null, boundary: [62, 93] },
      { id: 112, coords: null, boundary: [25, 93] },
      { id: 113, coords: null, boundary: [25, 62] },
      { id: 114, coords: null, boundary: [59, 133] },
      { id: 115, coords: null, boundary: [65, 133] },
      { id: 116, coords: null, boundary: [59, 65] },
      { id: 117, coords: null, boundary: [35, 101] },
      { id: 118, coords: null, boundary: [33, 101] },
      { id: 119, coords: null, boundary: [33, 35] },
      { id: 120, coords: null, boundary: [32, 118] },
      { id: 121, coords: null, boundary: [50, 118] },
      { id: 122, coords: null, boundary: [32, 50] },
      { id: 123, coords: null, boundary: [5, 100] },
      { id: 124, coords: null, boundary: [32, 100] },
      { id: 125, coords: null, boundary: [5, 32] },
      { id: 126, coords: null, boundary: [45, 69] },
      { id: 127, coords: null, boundary: [1, 69] },
      { id: 128, coords: null, boundary: [1, 45] },
      { id: 129, coords: null, boundary: [51, 82] },
      { id: 130, coords: null, boundary: [14, 82] },
      { id: 131, coords: null, boundary: [14, 51] },
      { id: 132, coords: null, boundary: [18, 120] },
      { id: 133, coords: null, boundary: [52, 120] },
      { id: 134, coords: null, boundary: [18, 52] },
      { id: 135, coords: null, boundary: [41, 126] },
      { id: 136, coords: null, boundary: [58, 126] },
      { id: 137, coords: null, boundary: [41, 58] },
      { id: 138, coords: null, boundary: [38, 76] },
      { id: 139, coords: null, boundary: [8, 76] },
      { id: 140, coords: null, boundary: [8, 38] },
      { id: 141, coords: null, boundary: [37, 111] },
      { id: 142, coords: null, boundary: [43, 111] },
      { id: 143, coords: null, boundary: [37, 43] },
      { id: 144, coords: null, boundary: [53, 102] },
      { id: 145, coords: null, boundary: [34, 102] },
      { id: 146, coords: null, boundary: [34, 53] },
      { id: 147, coords: null, boundary: [22, 77] },
      { id: 148, coords: null, boundary: [9, 77] },
      { id: 149, coords: null, boundary: [9, 22] },
      { id: 150, coords: null, boundary: [15, 117] },
      { id: 151, coords: null, boundary: [49, 117] },
      { id: 152, coords: null, boundary: [15, 49] },
      { id: 153, coords: null, boundary: [28, 68] },
      { id: 154, coords: null, boundary: [0, 68] },
      { id: 155, coords: null, boundary: [0, 28] },
      { id: 156, coords: null, boundary: [33, 127] },
      { id: 157, coords: null, boundary: [59, 127] },
      { id: 158, coords: null, boundary: [33, 59] },
      { id: 159, coords: null, boundary: [6, 98] },
      { id: 160, coords: null, boundary: [30, 98] },
      { id: 161, coords: null, boundary: [6, 30] },
      { id: 162, coords: null, boundary: [66, 124] },
      { id: 163, coords: null, boundary: [56, 124] },
      { id: 164, coords: null, boundary: [56, 66] },
      { id: 165, coords: null, boundary: [7, 89] },
      { id: 166, coords: null, boundary: [21, 89] },
      { id: 167, coords: null, boundary: [7, 21] },
      { id: 168, coords: null, boundary: [20, 135] },
      { id: 169, coords: null, boundary: [67, 135] },
      { id: 170, coords: null, boundary: [20, 67] },
      { id: 171, coords: null, boundary: [54, 87] },
      { id: 172, coords: null, boundary: [19, 87] },
      { id: 173, coords: null, boundary: [19, 54] },
      { id: 174, coords: null, boundary: [46, 78] },
      { id: 175, coords: null, boundary: [10, 78] },
      { id: 176, coords: null, boundary: [10, 46] },
      { id: 177, coords: null, boundary: [58, 84] },
      { id: 178, coords: null, boundary: [16, 84] },
      { id: 179, coords: null, boundary: [16, 58] },
      { id: 180, coords: null, boundary: [25, 112] },
      { id: 181, coords: null, boundary: [44, 112] },
      { id: 182, coords: null, boundary: [25, 44] },
      { id: 183, coords: null, boundary: [11, 99] },
      { id: 184, coords: null, boundary: [31, 99] },
      { id: 185, coords: null, boundary: [11, 31] },
      { id: 186, coords: null, boundary: [55, 115] },
      { id: 187, coords: null, boundary: [47, 115] },
      { id: 188, coords: null, boundary: [47, 55] },
      { id: 189, coords: null, boundary: [4, 121] },
      { id: 190, coords: null, boundary: [53, 121] },
      { id: 191, coords: null, boundary: [4, 53] },
      { id: 192, coords: null, boundary: [56, 94] },
      { id: 193, coords: null, boundary: [26, 94] },
      { id: 194, coords: null, boundary: [26, 56] },
      { id: 195, coords: null, boundary: [42, 91] },
      { id: 196, coords: null, boundary: [23, 91] },
      { id: 197, coords: null, boundary: [23, 42] },
      { id: 198, coords: null, boundary: [31, 108] },
      { id: 199, coords: null, boundary: [40, 108] },
      { id: 200, coords: null, boundary: [31, 40] },
      { id: 201, coords: null, boundary: [52, 71] },
      { id: 202, coords: null, boundary: [3, 71] },
      { id: 203, coords: null, boundary: [3, 52] },
      { id: 204, coords: null, boundary: [69, 131] },
      { id: 205, coords: null, boundary: [80, 111] },
      { id: 206, coords: null, boundary: [77, 104] },
      { id: 207, coords: null, boundary: [117, 132] },
      { id: 208, coords: null, boundary: [76, 116] },
      { id: 209, coords: null, boundary: [72, 135] },
      { id: 210, coords: null, boundary: [81, 94] },
      { id: 211, coords: null, boundary: [107, 114] },
      { id: 212, coords: null, boundary: [70, 102] },
      { id: 213, coords: null, boundary: [105, 131] },
      { id: 214, coords: null, boundary: [68, 129] },
      { id: 215, coords: null, boundary: [73, 84] },
      { id: 216, coords: null, boundary: [75, 125] },
      { id: 217, coords: null, boundary: [86, 108] },
      { id: 218, coords: null, boundary: [79, 80] },
      { id: 219, coords: null, boundary: [95, 115] },
      { id: 220, coords: null, boundary: [113, 118] },
      { id: 221, coords: null, boundary: [88, 129] },
      { id: 222, coords: null, boundary: [82, 109] },
      { id: 223, coords: null, boundary: [91, 125] },
      { id: 224, coords: null, boundary: [89, 96] },
      { id: 225, coords: null, boundary: [87, 92] },
      { id: 226, coords: null, boundary: [97, 98] },
      { id: 227, coords: null, boundary: [71, 130] },
      { id: 228, coords: null, boundary: [103, 128] },
      { id: 229, coords: null, boundary: [85, 133] },
      { id: 230, coords: null, boundary: [92, 107] },
      { id: 231, coords: null, boundary: [112, 134] },
      { id: 232, coords: null, boundary: [85, 110] },
      { id: 233, coords: null, boundary: [95, 119] },
      { id: 234, coords: null, boundary: [116, 123] },
      { id: 235, coords: null, boundary: [78, 128] },
      { id: 236, coords: null, boundary: [106, 132] },
      { id: 237, coords: null, boundary: [83, 104] },
      { id: 238, coords: null, boundary: [81, 122] },
      { id: 239, coords: null, boundary: [90, 97] },
      { id: 240, coords: null, boundary: [70, 74] },
      { id: 241, coords: null, boundary: [93, 130] },
      { id: 242, coords: null, boundary: [127, 133] },
      { id: 243, coords: null, boundary: [101, 103] },
      { id: 244, coords: null, boundary: [100, 118] },
      { id: 245, coords: null, boundary: [73, 100] },
      { id: 246, coords: null, boundary: [69, 113] },
      { id: 247, coords: null, boundary: [82, 119] },
      { id: 248, coords: null, boundary: [86, 120] },
      { id: 249, coords: null, boundary: [109, 126] },
      { id: 250, coords: null, boundary: [76, 106] },
      { id: 251, coords: null, boundary: [105, 111] },
      { id: 252, coords: null, boundary: [102, 121] },
      { id: 253, coords: null, boundary: [77, 90] },
      { id: 254, coords: null, boundary: [83, 117] },
      { id: 255, coords: null, boundary: [68, 96] },
      { id: 256, coords: null, boundary: [101, 127] },
      { id: 257, coords: null, boundary: [74, 98] },
      { id: 258, coords: null, boundary: [124, 134] },
      { id: 259, coords: null, boundary: [75, 89] },
      { id: 260, coords: null, boundary: [88, 135] },
      { id: 261, coords: null, boundary: [87, 122] },
      { id: 262, coords: null, boundary: [78, 114] },
      { id: 263, coords: null, boundary: [84, 126] },
      { id: 264, coords: null, boundary: [93, 112] },
      { id: 265, coords: null, boundary: [79, 99] },
      { id: 266, coords: null, boundary: [115, 123] },
      { id: 267, coords: null, boundary: [72, 121] },
      { id: 268, coords: null, boundary: [94, 124] },
      { id: 269, coords: null, boundary: [91, 110] },
      { id: 270, coords: null, boundary: [99, 108] },
      { id: 271, coords: null, boundary: [71, 120] },
    ],
    triangles: [
      { id: 0, coords: null, boundary: [0, 1, 2] },
      { id: 1, coords: null, boundary: [3, 4, 5] },
      { id: 2, coords: null, boundary: [6, 7, 8] },
      { id: 3, coords: null, boundary: [9, 10, 11] },
      { id: 4, coords: null, boundary: [12, 13, 14] },
      { id: 5, coords: null, boundary: [15, 16, 17] },
      { id: 6, coords: null, boundary: [18, 19, 20] },
      { id: 7, coords: null, boundary: [21, 22, 23] },
      { id: 8, coords: null, boundary: [24, 25, 26] },
      { id: 9, coords: null, boundary: [27, 28, 29] },
      { id: 10, coords: null, boundary: [30, 31, 32] },
      { id: 11, coords: null, boundary: [33, 34, 35] },
      { id: 12, coords: null, boundary: [36, 37, 38] },
      { id: 13, coords: null, boundary: [39, 40, 41] },
      { id: 14, coords: null, boundary: [42, 43, 44] },
      { id: 15, coords: null, boundary: [45, 46, 47] },
      { id: 16, coords: null, boundary: [48, 49, 50] },
      { id: 17, coords: null, boundary: [51, 52, 53] },
      { id: 18, coords: null, boundary: [54, 55, 56] },
      { id: 19, coords: null, boundary: [57, 58, 59] },
      { id: 20, coords: null, boundary: [60, 61, 62] },
      { id: 21, coords: null, boundary: [63, 64, 65] },
      { id: 22, coords: null, boundary: [66, 67, 68] },
      { id: 23, coords: null, boundary: [69, 70, 71] },
      { id: 24, coords: null, boundary: [72, 73, 74] },
      { id: 25, coords: null, boundary: [75, 76, 77] },
      { id: 26, coords: null, boundary: [78, 79, 80] },
      { id: 27, coords: null, boundary: [81, 82, 83] },
      { id: 28, coords: null, boundary: [84, 85, 86] },
      { id: 29, coords: null, boundary: [87, 88, 89] },
      { id: 30, coords: null, boundary: [90, 91, 92] },
      { id: 31, coords: null, boundary: [93, 94, 95] },
      { id: 32, coords: null, boundary: [96, 97, 98] },
      { id: 33, coords: null, boundary: [99, 100, 101] },
      { id: 34, coords: null, boundary: [102, 103, 104] },
      { id: 35, coords: null, boundary: [105, 106, 107] },
      { id: 36, coords: null, boundary: [108, 109, 110] },
      { id: 37, coords: null, boundary: [111, 112, 113] },
      { id: 38, coords: null, boundary: [114, 115, 116] },
      { id: 39, coords: null, boundary: [117, 118, 119] },
      { id: 40, coords: null, boundary: [120, 121, 122] },
      { id: 41, coords: null, boundary: [123, 124, 125] },
      { id: 42, coords: null, boundary: [126, 127, 128] },
      { id: 43, coords: null, boundary: [129, 130, 131] },
      { id: 44, coords: null, boundary: [132, 133, 134] },
      { id: 45, coords: null, boundary: [135, 136, 137] },
      { id: 46, coords: null, boundary: [138, 139, 140] },
      { id: 47, coords: null, boundary: [141, 142, 143] },
      { id: 48, coords: null, boundary: [144, 145, 146] },
      { id: 49, coords: null, boundary: [147, 148, 149] },
      { id: 50, coords: null, boundary: [150, 151, 152] },
      { id: 51, coords: null, boundary: [153, 154, 155] },
      { id: 52, coords: null, boundary: [156, 157, 158] },
      { id: 53, coords: null, boundary: [159, 160, 161] },
      { id: 54, coords: null, boundary: [162, 163, 164] },
      { id: 55, coords: null, boundary: [165, 166, 167] },
      { id: 56, coords: null, boundary: [168, 169, 170] },
      { id: 57, coords: null, boundary: [171, 172, 173] },
      { id: 58, coords: null, boundary: [174, 175, 176] },
      { id: 59, coords: null, boundary: [177, 178, 179] },
      { id: 60, coords: null, boundary: [180, 181, 182] },
      { id: 61, coords: null, boundary: [183, 184, 185] },
      { id: 62, coords: null, boundary: [186, 187, 188] },
      { id: 63, coords: null, boundary: [189, 190, 191] },
      { id: 64, coords: null, boundary: [192, 193, 194] },
      { id: 65, coords: null, boundary: [195, 196, 197] },
      { id: 66, coords: null, boundary: [198, 199, 200] },
      { id: 67, coords: null, boundary: [201, 202, 203] },
      { id: 68, coords: null, boundary: [127, 204, 0] },
      { id: 69, coords: null, boundary: [142, 205, 3] },
      { id: 70, coords: null, boundary: [148, 206, 6] },
      { id: 71, coords: null, boundary: [151, 207, 9] },
      { id: 72, coords: null, boundary: [139, 208, 12] },
      { id: 73, coords: null, boundary: [169, 209, 15] },
      { id: 74, coords: null, boundary: [193, 210, 18] },
      { id: 75, coords: null, boundary: [79, 211, 21] },
      { id: 76, coords: null, boundary: [145, 212, 24] },
      { id: 77, coords: null, boundary: [1, 213, 27] },
      { id: 78, coords: null, boundary: [154, 214, 30] },
      { id: 79, coords: null, boundary: [178, 215, 33] },
      { id: 80, coords: null, boundary: [58, 216, 36] },
      { id: 81, coords: null, boundary: [199, 217, 39] },
      { id: 82, coords: null, boundary: [4, 218, 42] },
      { id: 83, coords: null, boundary: [187, 219, 45] },
      { id: 84, coords: null, boundary: [121, 220, 48] },
      { id: 85, coords: null, boundary: [31, 221, 51] },
      { id: 86, coords: null, boundary: [130, 222, 54] },
      { id: 87, coords: null, boundary: [196, 223, 57] },
      { id: 88, coords: null, boundary: [166, 224, 60] },
      { id: 89, coords: null, boundary: [172, 225, 63] },
      { id: 90, coords: null, boundary: [160, 226, 66] },
      { id: 91, coords: null, boundary: [202, 227, 69] },
      { id: 92, coords: null, boundary: [94, 228, 72] },
      { id: 93, coords: null, boundary: [115, 229, 75] },
      { id: 94, coords: null, boundary: [64, 230, 78] },
      { id: 95, coords: null, boundary: [181, 231, 81] },
      { id: 96, coords: null, boundary: [76, 232, 84] },
      { id: 97, coords: null, boundary: [46, 233, 87] },
      { id: 98, coords: null, boundary: [13, 234, 90] },
      { id: 99, coords: null, boundary: [175, 235, 93] },
      { id: 100, coords: null, boundary: [10, 236, 96] },
      { id: 101, coords: null, boundary: [7, 237, 99] },
      { id: 102, coords: null, boundary: [19, 238, 102] },
      { id: 103, coords: null, boundary: [67, 239, 105] },
      { id: 104, coords: null, boundary: [25, 240, 108] },
      { id: 105, coords: null, boundary: [70, 241, 111] },
      { id: 106, coords: null, boundary: [157, 242, 114] },
      { id: 107, coords: null, boundary: [73, 243, 117] },
      { id: 108, coords: null, boundary: [124, 244, 120] },
      { id: 109, coords: null, boundary: [34, 245, 123] },
      { id: 110, coords: null, boundary: [49, 246, 126] },
      { id: 111, coords: null, boundary: [88, 247, 129] },
      { id: 112, coords: null, boundary: [40, 248, 132] },
      { id: 113, coords: null, boundary: [55, 249, 135] },
      { id: 114, coords: null, boundary: [97, 250, 138] },
      { id: 115, coords: null, boundary: [28, 251, 141] },
      { id: 116, coords: null, boundary: [190, 252, 144] },
      { id: 117, coords: null, boundary: [106, 253, 147] },
      { id: 118, coords: null, boundary: [100, 254, 150] },
      { id: 119, coords: null, boundary: [61, 255, 153] },
      { id: 120, coords: null, boundary: [118, 256, 156] },
      { id: 121, coords: null, boundary: [109, 257, 159] },
      { id: 122, coords: null, boundary: [82, 258, 162] },
      { id: 123, coords: null, boundary: [37, 259, 165] },
      { id: 124, coords: null, boundary: [52, 260, 168] },
      { id: 125, coords: null, boundary: [103, 261, 171] },
      { id: 126, coords: null, boundary: [22, 262, 174] },
      { id: 127, coords: null, boundary: [136, 263, 177] },
      { id: 128, coords: null, boundary: [112, 264, 180] },
      { id: 129, coords: null, boundary: [43, 265, 183] },
      { id: 130, coords: null, boundary: [91, 266, 186] },
      { id: 131, coords: null, boundary: [16, 267, 189] },
      { id: 132, coords: null, boundary: [163, 268, 192] },
      { id: 133, coords: null, boundary: [85, 269, 195] },
      { id: 134, coords: null, boundary: [184, 270, 198] },
      { id: 135, coords: null, boundary: [133, 271, 201] },
    ],
    key_point: [
      0.050243999999999914, -0.04936099999999988, 0.05446400000000001,
    ],
    vertex_ordering: {
      forwards: [
        22, 2, 71, 73, 50, 30, 78, 18, 107, 106, 103, 33, 23, 131, 62, 117, 39,
        45, 59, 134, 35, 14, 98, 32, 130, 93, 127, 79, 17, 92, 86, 42, 19, 75,
        63, 84, 111, 7, 113, 125, 51, 53, 38, 11, 102, 6, 121, 87, 99, 119, 10,
        70, 67, 55, 135, 94, 123, 25, 47, 66, 95, 27, 81, 3, 118, 58, 112, 43,
        20, 0, 69, 72, 48, 28, 76, 15, 105, 104, 101, 31, 21, 129, 60, 114, 37,
        44, 57, 132, 34, 12, 96, 29, 128, 89, 126, 77, 13, 88, 83, 40, 16, 74,
        61, 82, 108, 5, 110, 124, 49, 52, 36, 9, 100, 4, 120, 85, 97, 116, 8,
        68, 65, 54, 133, 90, 122, 24, 46, 64, 91, 26, 80, 1, 115, 56, 109, 41,
      ],
      backwards: [
        69, 131, 1, 63, 113, 105, 45, 37, 118, 111, 50, 43, 89, 96, 21, 75, 100,
        28, 7, 32, 68, 80, 0, 12, 125, 57, 129, 61, 73, 91, 5, 79, 23, 11, 88,
        20, 110, 84, 42, 16, 99, 135, 31, 67, 85, 17, 126, 58, 72, 108, 4, 40,
        109, 41, 121, 53, 133, 86, 65, 18, 82, 102, 14, 34, 127, 120, 59, 52,
        119, 70, 51, 2, 71, 3, 101, 33, 74, 95, 6, 27, 130, 62, 103, 98, 35,
        115, 30, 47, 97, 93, 123, 128, 29, 25, 55, 60, 90, 116, 22, 48, 112, 78,
        44, 10, 77, 76, 9, 8, 104, 134, 106, 36, 66, 38, 83, 132, 117, 15, 64,
        49, 114, 46, 124, 56, 107, 39, 94, 26, 92, 81, 24, 13, 87, 122, 19, 54,
      ],
    },
    edge_ordering: {
      forwards: [
        1, 3, 4, 36, 40, 41, 210, 215, 216, 233, 230, 234, 207, 191, 208, 90,
        94, 95, 254, 259, 260, 246, 238, 247, 131, 136, 137, 6, 11, 12, 46, 48,
        49, 71, 52, 72, 43, 28, 44, 107, 112, 113, 55, 60, 61, 167, 151, 168,
        16, 8, 17, 62, 64, 65, 117, 99, 118, 57, 45, 58, 22, 26, 27, 265, 256,
        266, 170, 176, 177, 154, 156, 157, 183, 161, 184, 109, 83, 110, 257,
        248, 258, 212, 217, 218, 84, 68, 85, 152, 133, 153, 192, 180, 193, 199,
        185, 200, 231, 219, 232, 222, 227, 228, 262, 268, 269, 186, 189, 190,
        146, 149, 150, 172, 178, 179, 125, 111, 126, 162, 143, 163, 31, 18, 32,
        53, 33, 54, 9, 2, 10, 134, 119, 135, 123, 128, 129, 100, 87, 101, 220,
        209, 221, 14, 19, 20, 115, 120, 121, 202, 205, 206, 229, 235, 236, 34,
        38, 39, 144, 127, 145, 159, 165, 166, 241, 243, 244, 29, 23, 30, 76, 80,
        81, 270, 267, 271, 239, 201, 240, 88, 73, 89, 194, 197, 198, 74, 78, 79,
        181, 169, 182, 102, 104, 105, 249, 251, 252, 69, 59, 70, 92, 96, 97,
        138, 140, 141, 0, 37, 211, 225, 204, 91, 255, 245, 132, 7, 47, 67, 42,
        108, 56, 164, 13, 63, 114, 51, 21, 261, 171, 155, 175, 106, 253, 213,
        82, 148, 188, 196, 224, 223, 263, 187, 147, 173, 122, 158, 25, 50, 5,
        130, 124, 98, 214, 15, 116, 203, 226, 35, 142, 160, 242, 24, 77, 264,
        237, 86, 195, 75, 174, 103, 250, 66, 93, 139,
      ],
      backwards: [
        204, 0, 127, 1, 2, 246, 27, 213, 49, 126, 128, 28, 29, 220, 141, 251,
        48, 50, 121, 142, 143, 224, 60, 166, 259, 244, 61, 62, 37, 165, 167,
        120, 122, 124, 153, 255, 3, 205, 154, 155, 4, 5, 216, 36, 38, 58, 30,
        214, 31, 32, 245, 223, 34, 123, 125, 42, 218, 57, 59, 196, 43, 44, 51,
        221, 52, 53, 269, 215, 85, 195, 197, 33, 35, 178, 183, 265, 168, 260,
        184, 185, 169, 170, 232, 76, 84, 86, 263, 136, 177, 179, 15, 209, 198,
        270, 16, 17, 199, 200, 249, 55, 135, 137, 189, 267, 190, 191, 229, 39,
        217, 75, 77, 115, 40, 41, 222, 144, 252, 54, 56, 130, 145, 146, 242,
        132, 248, 114, 116, 157, 133, 134, 247, 24, 212, 88, 129, 131, 25, 26,
        201, 271, 202, 203, 256, 118, 156, 158, 108, 240, 233, 109, 110, 46, 87,
        89, 69, 227, 70, 71, 243, 159, 257, 73, 117, 119, 219, 160, 161, 45, 47,
        187, 66, 226, 111, 241, 266, 228, 67, 68, 112, 113, 91, 186, 188, 72,
        74, 94, 105, 239, 234, 106, 107, 13, 90, 92, 180, 264, 235, 181, 182,
        93, 95, 175, 147, 253, 208, 148, 149, 12, 14, 139, 6, 206, 81, 231, 250,
        7, 8, 82, 83, 97, 138, 140, 99, 237, 236, 207, 254, 100, 101, 150, 10,
        96, 98, 9, 11, 151, 152, 262, 22, 174, 176, 162, 258, 163, 164, 211, 21,
        23, 79, 192, 268, 193, 194, 230, 18, 210, 64, 78, 80, 19, 20, 225, 102,
        238, 261, 63, 65, 172, 103, 104, 171, 173,
      ],
    },
    triangle_ordering: {
      forwards: [
        1, 19, 106, 115, 102, 46, 129, 122, 67, 5, 23, 34, 20, 55, 29, 82, 7,
        31, 57, 27, 11, 131, 86, 77, 90, 53, 127, 107, 40, 74, 94, 98, 113, 111,
        133, 93, 73, 87, 61, 79, 14, 24, 3, 65, 63, 48, 108, 9, 59, 101, 116,
        18, 70, 81, 121, 12, 39, 134, 118, 42, 97, 38, 88, 51, 125, 32, 47, 69,
        0, 17, 104, 117, 103, 44, 126, 123, 64, 2, 22, 35, 21, 52, 26, 83, 8,
        30, 58, 28, 10, 132, 84, 76, 91, 54, 128, 105, 41, 75, 95, 99, 114, 110,
        130, 92, 72, 85, 62, 80, 15, 25, 4, 66, 60, 49, 109, 6, 56, 100, 112,
        16, 71, 78, 120, 13, 37, 135, 119, 43, 96, 36, 89, 50, 124, 33, 45, 68,
      ],
      backwards: [
        68, 0, 77, 42, 110, 9, 115, 16, 84, 47, 88, 20, 55, 123, 40, 108, 119,
        69, 51, 1, 12, 80, 78, 10, 41, 109, 82, 19, 87, 14, 85, 17, 65, 133, 11,
        79, 129, 124, 61, 56, 28, 96, 59, 127, 73, 134, 5, 66, 45, 113, 131, 63,
        81, 25, 93, 13, 116, 18, 86, 48, 112, 38, 106, 44, 76, 43, 111, 8, 135,
        67, 52, 120, 104, 36, 29, 97, 91, 23, 121, 39, 107, 53, 15, 83, 90, 105,
        22, 37, 62, 130, 24, 92, 103, 35, 30, 98, 128, 60, 31, 99, 117, 49, 4,
        72, 70, 95, 2, 27, 46, 114, 101, 33, 118, 32, 100, 3, 50, 71, 58, 126,
        122, 54, 7, 75, 132, 64, 74, 26, 94, 6, 102, 21, 89, 34, 57, 125,
      ],
    },
    empty_barcode: [{ dim: -1, birth: null, death: [3.811905020525001, 69] }],
    vertex_barcode: [
      {
        dim: 0,
        birth: [4.376121441184999, 0],
        death: [4.376121441184999, 154],
      },
      { dim: 0, birth: [3.862983381425001, 1], death: [3.862983381425001, 0] },
      { dim: 0, birth: [6.657922234873, 2], death: [6.657922234873, 25] },
      { dim: 0, birth: [6.906375136964, 3], death: [6.906375136964, 202] },
      { dim: 0, birth: [5.444113793685, 4], death: [5.444113793685, 16] },
      { dim: 0, birth: [4.606317086200999, 5], death: [4.606317086200999, 34] },
      { dim: 0, birth: [7.070892152973, 6], death: [7.070892152973, 109] },
      {
        dim: 0,
        birth: [4.3102916292539994, 7],
        death: [4.3102916292539994, 37],
      },
      { dim: 0, birth: [8.427392774037001, 8], death: [8.427392774037001, 12] },
      { dim: 0, birth: [8.398958364365, 9], death: [8.398958364365, 148] },
      {
        dim: 0,
        birth: [8.268460294853996, 10],
        death: [8.268460294853996, 93],
      },
      {
        dim: 0,
        birth: [4.697553757284999, 11],
        death: [4.697553757284999, 43],
      },
      { dim: 0, birth: [4.382317432352999, 12], death: [4.382317432352999, 4] },
      {
        dim: 0,
        birth: [9.285353873149997, 13],
        death: [9.285353873149997, 19],
      },
      {
        dim: 0,
        birth: [6.2096482191260005, 14],
        death: [6.2096482191260005, 54],
      },
      { dim: 0, birth: [8.71403321971, 15], death: [8.71403321971, 100] },
      { dim: 0, birth: [4.954059569721, 16], death: [4.954059569721, 33] },
      {
        dim: 0,
        birth: [5.271262497959999, 17],
        death: [5.271262497959999, 76],
      },
      {
        dim: 0,
        birth: [5.948328893399999, 18],
        death: [5.948328893399999, 40],
      },
      {
        dim: 0,
        birth: [9.344463314941997, 19],
        death: [9.344463314941997, 63],
      },
      {
        dim: 0,
        birth: [4.792952455128999, 20],
        death: [4.792952455128999, 52],
      },
      { dim: 0, birth: [4.25322650442, 21], death: [4.25322650442, 60] },
      { dim: 0, birth: [8.140060410885, 22], death: [8.140060410885, 106] },
      {
        dim: 0,
        birth: [4.655440649029999, 23],
        death: [4.655440649029999, 57],
      },
      {
        dim: 0,
        birth: [9.249612802324998, 24],
        death: [9.249612802324998, 64],
      },
      {
        dim: 0,
        birth: [7.828477761968999, 25],
        death: [7.828477761968999, 112],
      },
      {
        dim: 0,
        birth: [9.132429964508999, 26],
        death: [9.132429964508999, 193],
      },
      {
        dim: 0,
        birth: [7.084180098414002, 27],
        death: [7.084180098414002, 46],
      },
      { dim: 0, birth: [4.27564022727, 28], death: [4.27564022727, 61] },
      { dim: 0, birth: [7.824911556296, 29], death: [7.824911556296, 67] },
      {
        dim: 0,
        birth: [7.464387085156999, 30],
        death: [7.464387085156999, 160],
      },
      { dim: 0, birth: [5.071452390766, 31], death: [5.071452390766, 184] },
      { dim: 0, birth: [4.31448414158, 32], death: [4.31448414158, 120] },
      {
        dim: 0,
        birth: [6.986849425987998, 33],
        death: [6.986849425987998, 118],
      },
      { dim: 0, birth: [6.239623538057, 34], death: [6.239623538057, 145] },
      {
        dim: 0,
        birth: [7.438529497904997, 35],
        death: [7.438529497904997, 73],
      },
      { dim: 0, birth: [8.592568021062002, 36], death: [8.592568021062002, 7] },
      {
        dim: 0,
        birth: [3.9634695310380006, 37],
        death: [3.9634695310380006, 28],
      },
      {
        dim: 0,
        birth: [8.613592410045001, 38],
        death: [8.613592410045001, 97],
      },
      {
        dim: 0,
        birth: [9.075518189901999, 39],
        death: [9.075518189901999, 21],
      },
      { dim: 0, birth: [5.492666768302, 40], death: [5.492666768302, 199] },
      { dim: 0, birth: [5.769241290918, 41], death: [5.769241290918, 55] },
      {
        dim: 0,
        birth: [4.933495968997999, 42],
        death: [4.933495968997999, 85],
      },
      { dim: 0, birth: [4.135201688214, 43], death: [4.135201688214, 142] },
      {
        dim: 0,
        birth: [8.240236035392998, 44],
        death: [8.240236035392998, 181],
      },
      { dim: 0, birth: [3.93614823903, 45], death: [3.93614823903, 49] },
      {
        dim: 0,
        birth: [8.828104252645998, 46],
        death: [8.828104252645998, 22],
      },
      {
        dim: 0,
        birth: [7.489768980232002, 47],
        death: [7.489768980232002, 45],
      },
      { dim: 0, birth: [8.172316821377, 48], death: [8.172316821377, 13] },
      { dim: 0, birth: [8.758879937937001, 49], death: [8.758879937937001, 9] },
      {
        dim: 0,
        birth: [4.088481484142001, 50],
        death: [4.088481484142001, 48],
      },
      {
        dim: 0,
        birth: [6.652795172588003, 51],
        death: [6.652795172588003, 88],
      },
      { dim: 0, birth: [6.424452049964, 52], death: [6.424452049964, 133] },
      { dim: 0, birth: [5.830332004248, 53], death: [5.830332004248, 190] },
      {
        dim: 0,
        birth: [9.356647708220997, 54],
        death: [9.356647708220997, 103],
      },
      {
        dim: 0,
        birth: [7.856415259221002, 55],
        death: [7.856415259221002, 91],
      },
      {
        dim: 0,
        birth: [8.902304107328998, 56],
        death: [8.902304107328998, 163],
      },
      { dim: 0, birth: [4.44562487202, 57], death: [4.44562487202, 36] },
      {
        dim: 0,
        birth: [5.346049687704999, 58],
        death: [5.346049687704999, 136],
      },
      {
        dim: 0,
        birth: [6.388123732205999, 59],
        death: [6.388123732205999, 114],
      },
      {
        dim: 0,
        birth: [7.870385770259999, 60],
        death: [7.870385770259999, 72],
      },
      { dim: 0, birth: [4.55069190884, 61], death: [4.55069190884, 31] },
      {
        dim: 0,
        birth: [7.379243462392998, 62],
        death: [7.379243462392998, 70],
      },
      {
        dim: 0,
        birth: [3.8719717536610005, 63],
        death: [3.8719717536610005, 1],
      },
      { dim: 0, birth: [8.725179352465, 64], death: [8.725179352465, 10] },
      {
        dim: 0,
        birth: [5.9463821280969995, 65],
        death: [5.9463821280969995, 75],
      },
      {
        dim: 0,
        birth: [8.601862947941997, 66],
        death: [8.601862947941997, 82],
      },
      {
        dim: 0,
        birth: [5.094273571255998, 67],
        death: [5.094273571255998, 169],
      },
      { dim: 0, birth: [4.325043080285, 68], death: [4.325043080285, 153] },
      {
        dim: 0,
        birth: [6.606843873973001, 70],
        death: [6.606843873973001, 24],
      },
      {
        dim: 0,
        birth: [6.855296776064001, 71],
        death: [6.855296776064001, 201],
      },
      {
        dim: 0,
        birth: [5.393035432785001, 72],
        death: [5.393035432785001, 15],
      },
      { dim: 0, birth: [4.555238725301, 73], death: [4.555238725301, 245] },
      {
        dim: 0,
        birth: [7.019813792073001, 74],
        death: [7.019813792073001, 108],
      },
      { dim: 0, birth: [4.259213268354, 75], death: [4.259213268354, 259] },
      { dim: 0, birth: [8.376314413137, 76], death: [8.376314413137, 208] },
      { dim: 0, birth: [8.347880003465, 77], death: [8.347880003465, 147] },
      {
        dim: 0,
        birth: [8.217381933953996, 78],
        death: [8.217381933953996, 235],
      },
      { dim: 0, birth: [4.646475396385, 79], death: [4.646475396385, 42] },
      { dim: 0, birth: [4.331239071453, 80], death: [4.331239071453, 3] },
      {
        dim: 0,
        birth: [9.234275512249997, 81],
        death: [9.234275512249997, 18],
      },
      {
        dim: 0,
        birth: [6.158569858226001, 82],
        death: [6.158569858226001, 222],
      },
      { dim: 0, birth: [8.66295485881, 83], death: [8.66295485881, 99] },
      {
        dim: 0,
        birth: [4.902981208821001, 84],
        death: [4.902981208821001, 215],
      },
      {
        dim: 0,
        birth: [5.2201841370599995, 85],
        death: [5.2201841370599995, 232],
      },
      { dim: 0, birth: [5.8972505325, 86], death: [5.8972505325, 39] },
      {
        dim: 0,
        birth: [9.293384954041997, 87],
        death: [9.293384954041997, 225],
      },
      { dim: 0, birth: [4.741874094229, 88], death: [4.741874094229, 51] },
      {
        dim: 0,
        birth: [4.2021481435200005, 89],
        death: [8.707801577037001, 254],
      },
      { dim: 0, birth: [8.088982049985, 90], death: [8.088982049985, 105] },
      { dim: 0, birth: [4.60436228813, 91], death: [4.60436228813, 223] },
      {
        dim: 0,
        birth: [9.198534441424998, 92],
        death: [9.198534441424998, 230],
      },
      { dim: 0, birth: [7.777399401069, 93], death: [7.777399401069, 111] },
      {
        dim: 0,
        birth: [9.081351603608999, 94],
        death: [9.081351603608999, 192],
      },
      {
        dim: 0,
        birth: [7.033101737514003, 95],
        death: [7.033101737514003, 233],
      },
      {
        dim: 0,
        birth: [4.224561866370001, 96],
        death: [4.224561866370001, 224],
      },
      {
        dim: 0,
        birth: [7.7738331953960005, 97],
        death: [7.7738331953960005, 66],
      },
      { dim: 0, birth: [7.413308724257, 98], death: [7.413308724257, 159] },
      {
        dim: 0,
        birth: [5.020374029866001, 99],
        death: [5.020374029866001, 183],
      },
      {
        dim: 0,
        birth: [4.263405780680001, 100],
        death: [4.263405780680001, 244],
      },
      {
        dim: 0,
        birth: [6.935771065087999, 101],
        death: [6.935771065087999, 256],
      },
      {
        dim: 0,
        birth: [6.188545177157001, 102],
        death: [6.188545177157001, 144],
      },
      {
        dim: 0,
        birth: [7.387451137004998, 103],
        death: [7.387451137004998, 243],
      },
      {
        dim: 0,
        birth: [8.541489660162002, 104],
        death: [8.541489660162002, 6],
      },
      {
        dim: 0,
        birth: [3.9123911701380005, 105],
        death: [3.9123911701380005, 27],
      },
      {
        dim: 0,
        birth: [8.562514049145001, 106],
        death: [8.562514049145001, 250],
      },
      {
        dim: 0,
        birth: [9.024439829001999, 107],
        death: [9.024439829001999, 211],
      },
      {
        dim: 0,
        birth: [5.4415884074020004, 108],
        death: [5.4415884074020004, 198],
      },
      {
        dim: 0,
        birth: [5.718162930018001, 109],
        death: [5.718162930018001, 249],
      },
      { dim: 0, birth: [4.882417608098, 110], death: [4.882417608098, 269] },
      {
        dim: 0,
        birth: [4.084123327314001, 111],
        death: [4.084123327314001, 141],
      },
      {
        dim: 0,
        birth: [8.189157674492998, 112],
        death: [8.189157674492998, 180],
      },
      { dim: 0, birth: [3.88506987813, 113], death: [3.88506987813, 246] },
      {
        dim: 0,
        birth: [8.777025891745998, 114],
        death: [8.777025891745998, 262],
      },
      {
        dim: 0,
        birth: [7.438690619332003, 115],
        death: [7.438690619332003, 219],
      },
      { dim: 0, birth: [8.121238460477, 116], death: [8.121238460477, 234] },
      {
        dim: 0,
        birth: [8.707801577037001, 117],
        death: [8.707801577037001, 207],
      },
      {
        dim: 0,
        birth: [4.037403123242002, 118],
        death: [4.037403123242002, 220],
      },
      {
        dim: 0,
        birth: [6.601716811688004, 119],
        death: [6.601716811688004, 247],
      },
      {
        dim: 0,
        birth: [6.3733736890640005, 120],
        death: [6.3733736890640005, 132],
      },
      { dim: 0, birth: [5.779253643348, 121], death: [5.779253643348, 189] },
      {
        dim: 0,
        birth: [9.305569347320997, 122],
        death: [9.305569347320997, 102],
      },
      {
        dim: 0,
        birth: [7.805336898321003, 123],
        death: [7.805336898321003, 266],
      },
      {
        dim: 0,
        birth: [8.851225746428998, 124],
        death: [8.851225746428998, 162],
      },
      {
        dim: 0,
        birth: [4.394546511120001, 125],
        death: [4.394546511120001, 216],
      },
      { dim: 0, birth: [5.294971326805, 126], death: [5.294971326805, 263] },
      { dim: 0, birth: [6.337045371306, 127], death: [6.337045371306, 242] },
      {
        dim: 0,
        birth: [7.8193074093599995, 128],
        death: [7.8193074093599995, 228],
      },
      {
        dim: 0,
        birth: [4.499613547940001, 129],
        death: [4.499613547940001, 30],
      },
      {
        dim: 0,
        birth: [7.328165101492999, 130],
        death: [7.328165101492999, 69],
      },
      {
        dim: 0,
        birth: [3.8208933927610005, 131],
        death: [3.8208933927610005, 204],
      },
      { dim: 0, birth: [8.674100991565, 132], death: [8.674100991565, 236] },
      { dim: 0, birth: [5.895303767197, 133], death: [5.895303767197, 229] },
      {
        dim: 0,
        birth: [8.550784587041997, 134],
        death: [8.550784587041997, 81],
      },
      {
        dim: 0,
        birth: [5.043195210355999, 135],
        death: [5.043195210355999, 168],
      },
    ],
    edge_barcode: [
      {
        dim: 1,
        birth: [3.8719717536610005, 2],
        death: [3.8719717536610005, 0],
      },
      { dim: 1, birth: [4.382317432352999, 5], death: [4.382317432352999, 1] },
      { dim: 1, birth: [8.592568021062002, 8], death: [8.592568021062002, 2] },
      { dim: 1, birth: [8.758879937937001, 11], death: [8.758879937937001, 3] },
      { dim: 1, birth: [8.427392774037001, 14], death: [8.427392774037001, 4] },
      { dim: 1, birth: [5.444113793685, 17], death: [5.444113793685, 5] },
      { dim: 1, birth: [9.285353873149997, 20], death: [9.285353873149997, 6] },
      { dim: 1, birth: [9.075518189901999, 23], death: [9.075518189901999, 7] },
      { dim: 1, birth: [6.657922234873, 26], death: [6.657922234873, 8] },
      {
        dim: 1,
        birth: [3.9634695310380006, 29],
        death: [3.9634695310380006, 9],
      },
      { dim: 1, birth: [4.55069190884, 32], death: [4.55069190884, 10] },
      { dim: 1, birth: [4.954059569721, 35], death: [4.954059569721, 11] },
      { dim: 1, birth: [4.44562487202, 38], death: [4.44562487202, 12] },
      {
        dim: 1,
        birth: [5.948328893399999, 41],
        death: [5.948328893399999, 13],
      },
      {
        dim: 1,
        birth: [4.697553757284999, 44],
        death: [4.697553757284999, 14],
      },
      {
        dim: 1,
        birth: [7.489768980232002, 47],
        death: [7.489768980232002, 15],
      },
      {
        dim: 1,
        birth: [4.088481484142001, 50],
        death: [4.088481484142001, 16],
      },
      {
        dim: 1,
        birth: [4.792952455128999, 53],
        death: [4.792952455128999, 17],
      },
      {
        dim: 1,
        birth: [6.2096482191260005, 56],
        death: [6.2096482191260005, 18],
      },
      { dim: 1, birth: [4.44562487202, 58], death: [4.44562487202, 80] },
      {
        dim: 1,
        birth: [4.655440649029999, 59],
        death: [4.655440649029999, 19],
      },
      { dim: 1, birth: [4.27564022727, 62], death: [4.27564022727, 20] },
      {
        dim: 1,
        birth: [9.344463314941997, 65],
        death: [9.344463314941997, 21],
      },
      { dim: 1, birth: [7.824911556296, 68], death: [7.824911556296, 22] },
      {
        dim: 1,
        birth: [7.379243462392998, 71],
        death: [7.379243462392998, 23],
      },
      {
        dim: 1,
        birth: [7.870385770259999, 74],
        death: [7.870385770259999, 24],
      },
      {
        dim: 1,
        birth: [5.9463821280969995, 77],
        death: [5.9463821280969995, 25],
      },
      {
        dim: 1,
        birth: [9.249612802324998, 78],
        death: [9.249612802324998, 94],
      },
      {
        dim: 1,
        birth: [9.075518189901999, 79],
        death: [9.075518189901999, 75],
      },
      {
        dim: 1,
        birth: [9.249612802324998, 80],
        death: [9.249612802324998, 26],
      },
      {
        dim: 1,
        birth: [8.601862947941997, 83],
        death: [8.601862947941997, 27],
      },
      {
        dim: 1,
        birth: [5.271262497959999, 84],
        death: [5.271262497959999, 96],
      },
      {
        dim: 1,
        birth: [5.271262497959999, 86],
        death: [5.271262497959999, 28],
      },
      {
        dim: 1,
        birth: [7.084180098414002, 87],
        death: [7.084180098414002, 97],
      },
      {
        dim: 1,
        birth: [7.084180098414002, 89],
        death: [7.084180098414002, 29],
      },
      { dim: 1, birth: [8.172316821377, 90], death: [8.172316821377, 98] },
      { dim: 1, birth: [8.172316821377, 92], death: [8.172316821377, 30] },
      {
        dim: 1,
        birth: [7.870385770259999, 94],
        death: [7.870385770259999, 92],
      },
      {
        dim: 1,
        birth: [8.268460294853996, 95],
        death: [8.268460294853996, 31],
      },
      { dim: 1, birth: [8.725179352465, 96], death: [8.725179352465, 100] },
      { dim: 1, birth: [8.725179352465, 98], death: [8.725179352465, 32] },
      { dim: 1, birth: [8.71403321971, 101], death: [8.71403321971, 33] },
      {
        dim: 1,
        birth: [9.356647708220997, 104],
        death: [9.356647708220997, 34],
      },
      { dim: 1, birth: [8.140060410885, 107], death: [8.140060410885, 35] },
      { dim: 1, birth: [7.070892152973, 110], death: [7.070892152973, 36] },
      {
        dim: 1,
        birth: [7.828477761968999, 113],
        death: [7.828477761968999, 37],
      },
      {
        dim: 1,
        birth: [5.9463821280969995, 115],
        death: [5.9463821280969995, 93],
      },
      {
        dim: 1,
        birth: [6.388123732205999, 116],
        death: [6.388123732205999, 38],
      },
      {
        dim: 1,
        birth: [7.438529497904997, 117],
        death: [7.438529497904997, 107],
      },
      {
        dim: 1,
        birth: [7.438529497904997, 119],
        death: [7.438529497904997, 39],
      },
      {
        dim: 1,
        birth: [4.088481484142001, 121],
        death: [4.088481484142001, 84],
      },
      { dim: 1, birth: [4.31448414158, 122], death: [4.31448414158, 40] },
      {
        dim: 1,
        birth: [4.606317086200999, 123],
        death: [4.606317086200999, 109],
      },
      { dim: 1, birth: [4.31448414158, 124], death: [4.31448414158, 108] },
      {
        dim: 1,
        birth: [4.606317086200999, 125],
        death: [4.606317086200999, 41],
      },
      { dim: 1, birth: [3.93614823903, 126], death: [3.93614823903, 110] },
      {
        dim: 1,
        birth: [3.862983381425001, 127],
        death: [3.862983381425001, 68],
      },
      { dim: 1, birth: [3.93614823903, 128], death: [3.93614823903, 42] },
      {
        dim: 1,
        birth: [6.652795172588003, 129],
        death: [6.652795172588003, 111],
      },
      {
        dim: 1,
        birth: [6.2096482191260005, 130],
        death: [6.2096482191260005, 86],
      },
      {
        dim: 1,
        birth: [6.652795172588003, 131],
        death: [6.652795172588003, 43],
      },
      { dim: 1, birth: [6.424452049964, 134], death: [6.424452049964, 44] },
      { dim: 1, birth: [5.769241290918, 135], death: [5.769241290918, 113] },
      { dim: 1, birth: [5.769241290918, 137], death: [5.769241290918, 45] },
      {
        dim: 1,
        birth: [8.613592410045001, 138],
        death: [8.613592410045001, 114],
      },
      {
        dim: 1,
        birth: [8.427392774037001, 139],
        death: [8.427392774037001, 72],
      },
      {
        dim: 1,
        birth: [8.613592410045001, 140],
        death: [8.613592410045001, 46],
      },
      { dim: 1, birth: [4.135201688214, 143], death: [4.135201688214, 47] },
      { dim: 1, birth: [6.239623538057, 146], death: [6.239623538057, 48] },
      { dim: 1, birth: [8.398958364365, 149], death: [8.398958364365, 49] },
      { dim: 1, birth: [8.71403321971, 150], death: [8.71403321971, 118] },
      {
        dim: 1,
        birth: [8.758879937937001, 151],
        death: [8.758879937937001, 71],
      },
      {
        dim: 1,
        birth: [8.758879937937001, 152],
        death: [8.758879937937001, 50],
      },
      {
        dim: 1,
        birth: [4.376121441184999, 155],
        death: [4.376121441184999, 51],
      },
      {
        dim: 1,
        birth: [6.986849425987998, 156],
        death: [6.986849425987998, 120],
      },
      {
        dim: 1,
        birth: [6.388123732205999, 157],
        death: [6.388123732205999, 106],
      },
      {
        dim: 1,
        birth: [6.986849425987998, 158],
        death: [6.986849425987998, 52],
      },
      {
        dim: 1,
        birth: [7.464387085156999, 161],
        death: [7.464387085156999, 53],
      },
      {
        dim: 1,
        birth: [8.902304107328998, 164],
        death: [8.902304107328998, 54],
      },
      {
        dim: 1,
        birth: [4.3102916292539994, 165],
        death: [4.3102916292539994, 123],
      },
      { dim: 1, birth: [4.25322650442, 166], death: [4.25322650442, 88] },
      {
        dim: 1,
        birth: [4.3102916292539994, 167],
        death: [4.3102916292539994, 55],
      },
      {
        dim: 1,
        birth: [5.094273571255998, 170],
        death: [5.094273571255998, 56],
      },
      {
        dim: 1,
        birth: [9.356647708220997, 171],
        death: [9.356647708220997, 125],
      },
      {
        dim: 1,
        birth: [9.344463314941997, 172],
        death: [9.344463314941997, 89],
      },
      {
        dim: 1,
        birth: [9.356647708220997, 173],
        death: [9.356647708220997, 57],
      },
      {
        dim: 1,
        birth: [8.828104252645998, 174],
        death: [8.828104252645998, 126],
      },
      {
        dim: 1,
        birth: [8.268460294853996, 175],
        death: [8.268460294853996, 99],
      },
      {
        dim: 1,
        birth: [8.828104252645998, 176],
        death: [8.828104252645998, 58],
      },
      {
        dim: 1,
        birth: [5.346049687704999, 177],
        death: [5.346049687704999, 127],
      },
      { dim: 1, birth: [4.954059569721, 178], death: [4.954059569721, 79] },
      {
        dim: 1,
        birth: [5.346049687704999, 179],
        death: [5.346049687704999, 59],
      },
      {
        dim: 1,
        birth: [8.240236035392998, 182],
        death: [8.240236035392998, 60],
      },
      { dim: 1, birth: [5.071452390766, 185], death: [5.071452390766, 61] },
      {
        dim: 1,
        birth: [7.856415259221002, 186],
        death: [7.856415259221002, 130],
      },
      {
        dim: 1,
        birth: [7.489768980232002, 187],
        death: [7.489768980232002, 83],
      },
      {
        dim: 1,
        birth: [7.856415259221002, 188],
        death: [7.856415259221002, 62],
      },
      { dim: 1, birth: [5.830332004248, 191], death: [5.830332004248, 63] },
      {
        dim: 1,
        birth: [9.132429964508999, 194],
        death: [9.132429964508999, 64],
      },
      {
        dim: 1,
        birth: [4.933495968997999, 195],
        death: [4.933495968997999, 133],
      },
      {
        dim: 1,
        birth: [4.655440649029999, 196],
        death: [4.655440649029999, 87],
      },
      {
        dim: 1,
        birth: [4.933495968997999, 197],
        death: [4.933495968997999, 65],
      },
      { dim: 1, birth: [5.492666768302, 200], death: [5.492666768302, 66] },
      { dim: 1, birth: [6.906375136964, 203], death: [6.906375136964, 67] },
      { dim: 1, birth: [4.331239071453, 205], death: [4.331239071453, 69] },
      {
        dim: 1,
        birth: [8.541489660162002, 206],
        death: [8.541489660162002, 70],
      },
      {
        dim: 1,
        birth: [5.393035432785001, 209],
        death: [5.393035432785001, 73],
      },
      {
        dim: 1,
        birth: [9.234275512249997, 210],
        death: [9.234275512249997, 74],
      },
      {
        dim: 1,
        birth: [6.606843873973001, 212],
        death: [6.606843873973001, 76],
      },
      {
        dim: 1,
        birth: [3.9123911701380005, 213],
        death: [3.9123911701380005, 77],
      },
      {
        dim: 1,
        birth: [4.499613547940001, 214],
        death: [4.499613547940001, 78],
      },
      { dim: 1, birth: [5.8972505325, 217], death: [5.8972505325, 81] },
      { dim: 1, birth: [4.646475396385, 218], death: [4.646475396385, 82] },
      { dim: 1, birth: [4.741874094229, 221], death: [4.741874094229, 85] },
      {
        dim: 1,
        birth: [7.7738331953960005, 226],
        death: [7.7738331953960005, 90],
      },
      {
        dim: 1,
        birth: [7.328165101492999, 227],
        death: [7.328165101492999, 91],
      },
      {
        dim: 1,
        birth: [8.550784587041997, 231],
        death: [8.550784587041997, 95],
      },
      { dim: 1, birth: [8.66295485881, 237], death: [8.66295485881, 101] },
      {
        dim: 1,
        birth: [9.305569347320997, 238],
        death: [9.305569347320997, 102],
      },
      { dim: 1, birth: [8.088982049985, 239], death: [8.088982049985, 103] },
      {
        dim: 1,
        birth: [7.019813792073001, 240],
        death: [7.019813792073001, 104],
      },
      { dim: 1, birth: [7.777399401069, 241], death: [7.777399401069, 105] },
      {
        dim: 1,
        birth: [6.3733736890640005, 248],
        death: [6.3733736890640005, 112],
      },
      {
        dim: 1,
        birth: [4.084123327314001, 251],
        death: [4.084123327314001, 115],
      },
      {
        dim: 1,
        birth: [6.188545177157001, 252],
        death: [6.188545177157001, 116],
      },
      { dim: 1, birth: [8.347880003465, 253], death: [8.347880003465, 117] },
      { dim: 1, birth: [4.325043080285, 255], death: [4.325043080285, 119] },
      { dim: 1, birth: [7.413308724257, 257], death: [7.413308724257, 121] },
      {
        dim: 1,
        birth: [8.851225746428998, 258],
        death: [8.851225746428998, 122],
      },
      {
        dim: 1,
        birth: [5.043195210355999, 260],
        death: [5.043195210355999, 124],
      },
      { dim: 1, birth: [9.305569347320997, 261], death: null },
      {
        dim: 1,
        birth: [8.189157674492998, 264],
        death: [8.189157674492998, 128],
      },
      {
        dim: 1,
        birth: [5.020374029866001, 265],
        death: [5.020374029866001, 129],
      },
      { dim: 1, birth: [5.779253643348, 267], death: [5.779253643348, 131] },
      {
        dim: 1,
        birth: [9.081351603608999, 268],
        death: [9.081351603608999, 132],
      },
      {
        dim: 1,
        birth: [5.4415884074020004, 270],
        death: [5.4415884074020004, 134],
      },
      {
        dim: 1,
        birth: [6.855296776064001, 271],
        death: [6.855296776064001, 135],
      },
    ],
    triangle_barcode: [],
  };
};

function App() {
  const keypointRadius = useAtomValue(keypointRadiusAtom);

  const [wireframe, setWireframe] = useState(false);
  const [triangle, setTriangle] = useState<THREE.Vector3[] | undefined>(
    undefined
  );

  const [json, setJson] = useState<Json | undefined>(getDefaultJson);

  const onJson = useCallback((json: Json) => {
    setJson(json);
  }, []);

  const bdPair = useAtomValue(selectedBirthDeathPair);
  const timelinePosition = useAtomValue(timelinePositionAtom);

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
                          (v) => new THREE.Vector3(...json.vertices[v].coords!)
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

              {timelinePosition && (
                <RedTransparentSphere
                  pos={new THREE.Vector3(...json.key_point)}
                  radius={Math.sqrt(timelinePosition)}
                  opacity={0.2}
                />
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
