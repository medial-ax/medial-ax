import { MeshProps } from "@react-three/fiber";
import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { dedup } from "./utils";
import { Wireframe } from "@react-three/drei";
import { useAtomValue } from "jotai";
import { Dim, gridAtom, gridRadiusAtom, swapsForMA } from "./state";
import { dualFaceQuad, gridCoordinate } from "./medialaxes";
import { Grid } from "./types";
import { colors } from "./constants";

export const RedSphere = ({
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

export const RedEdge = ({
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

export const RedTriangle = ({ points }: { points: THREE.Vector3[] }) => {
  const ref = useRef<THREE.BufferAttribute>(null);

  useLayoutEffect(() => {
    if (!ref.current) return;
    ref.current.array = new Float32Array(
      points.flatMap((p) => [p.x, p.y, p.z]),
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

export const RenderComplex = ({
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
        t["boundary"].map((ei: number) => edges[ei].boundary).flat(),
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

export const RenderGrid = () => {
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

export const RenderMedialAxis = ({
  grid,
  dim,
  wireframe,
}: {
  grid: Grid;
  dim: Dim;
  wireframe?: boolean;
}) => {
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

