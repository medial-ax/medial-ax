import { MeshProps } from "@react-three/fiber";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import { dedup } from "./utils";
import { Wireframe } from "@react-three/drei";
import { useAtom, useAtomValue } from "jotai";
import {
  Dim,
  gridAtom,
  gridRadiusAtom,
  highlightAtom,
  selectedGridIndex,
  swapsAtom,
  swapsForMA,
} from "./state";
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
}: {
  cplx: any;
  wireframe?: boolean;
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

  const highlights = useAtomValue(highlightAtom);

  const vertices = highlights
    .filter((h) => h.dim === 0)
    .map((h, i) => {
      const pos = cplx.simplices_per_dim[0][h.index].coords;
      return (
        <RedSphere key={i} pos={new THREE.Vector3(...pos)} radius={0.04} />
      );
    });

  const edges = highlights
    .filter((h) => h.dim === 1)
    .map((h, i) => {
      const edge = cplx.simplices_per_dim[1][h.index];
      const p = cplx.simplices_per_dim[0][edge.boundary[0]];
      const q = cplx.simplices_per_dim[0][edge.boundary[1]];
      return (
        <RedEdge
          key={i}
          from={new THREE.Vector3(...p.coords)}
          to={new THREE.Vector3(...q.coords)}
          radius={0.02}
        />
      );
    });

  return (
    <>
      <mesh>
        <bufferGeometry attach="geometry">
          <bufferAttribute
            ref={ref}
            attach="attributes-position"
            count={coords.length / 3}
            array={coords}
            itemSize={3}
          />
        </bufferGeometry>
        <meshLambertMaterial
          color="#f3f3f3"
          flatShading
          side={THREE.DoubleSide}
        />
        {wireframe && <Wireframe />}
      </mesh>
      {vertices}
      {edges}
    </>
  );
};

const GRID_COLOR = new THREE.Color(0x888888);
const GRID_SELECTED_COLOR = new THREE.Color(0xff0000);

export const RenderGrid = () => {
  const radius = useAtomValue(gridRadiusAtom);
  const grid = useAtomValue(gridAtom);
  const meshref = useRef<THREE.InstancedMesh>(null);
  const _swaps = useAtomValue(swapsAtom);

  const [count, setCount] = useState(0);
  useEffect(() => {
    setTimeout(() => {
      setCount((c) => c + 1);
    }, 10);
  }, [_swaps]);

  const points = useMemo(() => {
    if (!grid) return;
    count; // refresh after computing MA
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
  }, [grid, count]);

  useLayoutEffect(() => {
    const m = meshref.current;
    if (!m || !points) return;

    points.forEach((p, i) => {
      m.setColorAt(i, GRID_COLOR);
      m.setMatrixAt(i, new THREE.Matrix4().makeTranslation(...p));
      m.instanceMatrix.needsUpdate = true;
    });
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [points]);

  const [selGridIndex, setSelGridIndex] = useAtom(selectedGridIndex);
  useLayoutEffect(() => {
    const m = meshref.current;
    if (!m || !selGridIndex || !grid) return;
    const [x, y, z] = selGridIndex;
    const [, Y, Z] = grid.shape;
    const index = x * Y * Z + y * Z + z;

    const ic = m.instanceColor;
    m.setColorAt(index, GRID_SELECTED_COLOR);
    if (ic) ic.needsUpdate = true;

    return () => {
      m.setColorAt(index, GRID_COLOR);
      if (ic) ic.needsUpdate = true;
    };
  }, [grid, selGridIndex]);

  if (!grid || !points) return null;

  return (
    <instancedMesh
      ref={meshref}
      args={[undefined, undefined, points.length]}
      onClick={(e) => {
        // NOTE: We have an implicit camera somewhere, not sure what the parameters actually are.
        const probablyNearClipPlane = 0.1;
        const closest = e.intersections.filter(
          (e) => e.distance > probablyNearClipPlane,
        )[0];
        if (!closest) {
          setSelGridIndex(undefined);
          return;
        }
        const { instanceId } = closest;
        if (instanceId === undefined) return;
        const [, Y, Z] = grid.shape;
        const z = instanceId % Z;
        const y = Math.floor(instanceId / Z) % Y;
        const x = Math.floor(instanceId / Z / Y);
        setSelGridIndex([x, y, z]);
      }}
    >
      <boxGeometry args={[radius, radius, radius]} />
      <meshBasicMaterial
        side={THREE.DoubleSide}
        attach="material"
        transparent
        opacity={0.5}
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
