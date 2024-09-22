import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import { dedup, range, repeat, swapHasGridIndices } from "./utils";
import { Wireframe } from "@react-three/drei";
import { atom, useAtom, useAtomValue } from "jotai";
import {
  Dim,
  gridAtom,
  gridRadiusAtom,
  hasAnySwaps,
  highlightAtom,
  maFaceSelection,
  selectedGridIndex,
  swapsAtom,
  swapsForMA,
  timelinePositionAtom,
} from "./state";
import { dualFaceQuad, gridCoordinate } from "./medialaxes";
import { Complex, Grid, MeshGrid } from "./types";
import { run } from "./work";
import { atomFamily } from "jotai/utils";

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

const WireframeEdge = ({
  from,
  to,
}: {
  from: THREE.Vector3;
  to: THREE.Vector3;
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
      <cylinderGeometry args={[0.004, 0.004, len]} />
      <meshLambertMaterial attach="material" color="#000000" />
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
  cplx: Complex;
  wireframe?: boolean;
}) => {
  const timeline = useAtomValue(timelinePositionAtom);

  const getCoords = useCallback(() => {
    const [vertices, edges, triangles] = cplx["simplices_per_dim"];
    const out = triangles.flatMap((t: any) => {
      const vis: number[] = dedup(
        t["boundary"].map((ei: number) => edges[ei].boundary).flat(),
      );
      const coords = vis.flatMap((i: number) => vertices[i].coords!);
      return coords;
    });
    return new Float32Array(out);
  }, [cplx]);

  const coords = useMemo(() => getCoords(), [getCoords]);

  const hasSwaps = useAtomValue(hasAnySwaps);
  const index = useAtomValue(selectedGridIndex);
  const [filtration, setFiltration] = useState<number[][] | undefined>(
    undefined,
  );

  useEffect(() => {
    if (!index || !hasSwaps) return;
    let stop = false;
    run("get-filtration-values-for-point", {
      grid_point: index,
    })
      .then((data) => {
        if (stop) return;
        setFiltration(data);
      })
      .catch((e) => {
        window.alert(`bad: ${e.message}`);
      });

    return () => {
      stop = true;
    };
  }, [hasSwaps, index]);

  const colors = useMemo(() => {
    const triangles = cplx.simplices_per_dim[2];
    const gray = [0.953, 0.953, 0.953];
    const red = [1.0, 0.5, 0.5];
    if (!filtration) {
      const n = triangles.length * 3;
      return new Float32Array(repeat(gray, n));
    }
    const floats = triangles.flatMap((_, i: number) => {
      const value = filtration[2][i];
      if (value <= timeline) {
        return repeat(red, 3);
      } else {
        return repeat(gray, 3);
      }
    });
    return new Float32Array(floats);
  }, [cplx.simplices_per_dim, filtration, timeline]);

  const ref = useRef<THREE.BufferAttribute>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    ref.current.array = new Float32Array(getCoords());
    ref.current.needsUpdate = true;
  }, [getCoords]);

  const colorRef = useRef<THREE.BufferAttribute>(null);
  useLayoutEffect(() => {
    if (!colorRef.current) return;
    colorRef.current.array = new Float32Array(colors);
    colorRef.current.needsUpdate = true;
  }, [colors]);

  const highlights = useAtomValue(highlightAtom);

  const filteredVertices = useMemo(() => {
    if (!filtration) return [];
    const n = cplx.simplices_per_dim[0].length;
    return range(0, n)
      .filter((i) => filtration[0][i] < timeline)
      .map((id) => {
        const pos = cplx.simplices_per_dim[0][id].coords!;
        return (
          <RedSphere key={id} pos={new THREE.Vector3(...pos)} radius={0.015} />
        );
      });
  }, [cplx.simplices_per_dim, filtration, timeline]);

  const filteredEdges = useMemo(() => {
    if (!filtration) return [];
    const n = cplx.simplices_per_dim[1].length;
    return range(0, n)
      .filter((i) => filtration[1][i] < timeline)
      .map((id) => {
        const edge = cplx.simplices_per_dim[1][id];
        const p = cplx.simplices_per_dim[0][edge.boundary[0]];
        const q = cplx.simplices_per_dim[0][edge.boundary[1]];
        return (
          <RedEdge
            key={id}
            from={new THREE.Vector3(...p.coords!)}
            to={new THREE.Vector3(...q.coords!)}
            radius={0.005}
          />
        );
      });
  }, [cplx.simplices_per_dim, filtration, timeline]);

  const vertices = highlights
    .filter((h) => h.dim === 0)
    .map((h, i) => {
      const pos = cplx.simplices_per_dim[0][h.index].coords!;
      return (
        <RedSphere key={i} pos={new THREE.Vector3(...pos)} radius={0.03} />
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
          from={new THREE.Vector3(...p.coords!)}
          to={new THREE.Vector3(...q.coords!)}
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
          <bufferAttribute
            ref={colorRef}
            attach="attributes-color"
            count={colors.length / 3}
            array={colors}
            itemSize={3}
          />
        </bufferGeometry>
        <meshLambertMaterial
          vertexColors
          color="#f3f3f3"
          flatShading
          side={THREE.DoubleSide}
        />
        {wireframe &&
          range(0, cplx.simplices_per_dim[1].length).map((id) => {
            const edge = cplx.simplices_per_dim[1][id];
            const p = cplx.simplices_per_dim[0][edge.boundary[0]];
            const q = cplx.simplices_per_dim[0][edge.boundary[1]];
            return (
              <WireframeEdge
                key={id}
                from={new THREE.Vector3(...p.coords!)}
                to={new THREE.Vector3(...q.coords!)}
              />
            );
          })}
      </mesh>
      {vertices}
      {edges}
      {filteredVertices}
      {filteredEdges}
    </>
  );
};

const GRID_COLOR = new THREE.Color(0x888888);
const GRID_SELECTED_COLOR = new THREE.Color(0x000000);

const RenderMeshGrid = ({ grid }: { grid: MeshGrid }) => {
  const radius = useAtomValue(gridRadiusAtom);

  const _swaps = useAtomValue(swapsAtom);
  const [count, setCount] = useState(0);
  useEffect(() => {
    setTimeout(() => {
      setCount((c) => c + 1);
    }, 10);
  }, [_swaps]);

  const meshref = useRef<THREE.InstancedMesh>(null);

  const points = useMemo(() => {
    if (!grid) return;
    count; // refresh after computing MA
    const coords: [number, number, number][] = [];
    for (const p of grid.points) coords.push([p[0], p[1], p[2]]);
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
    const [index] = selGridIndex;

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
        setSelGridIndex([instanceId, 0, 0]);
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

const RenderBasicGrid = ({ grid }: { grid: Grid }) => {
  const radius = useAtomValue(gridRadiusAtom);
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

export const RenderGrid = () => {
  const grid = useAtomValue(gridAtom);
  if (!grid) return null;
  if (grid.type === "grid") return <RenderBasicGrid grid={grid} />;
  if (grid.type === "meshgrid") return <RenderMeshGrid grid={grid} />;
};

const meshDualFaces = atomFamily((dim: Dim) =>
  atom<Promise<[Float32Array, number] | undefined>>(async (get) => {
    const grid = get(gridAtom);
    if (!grid) return undefined;

    const swaps = get(swapsForMA(dim));

    let allCoords: number[] = [];
    if (grid.type === "grid") {
      for (const [p, q] of swaps) {
        const [a, b, c, d] = dualFaceQuad(grid, p, q);
        const vertexcoords = [...a, ...b, ...c, ...a, ...c, ...d];
        allCoords = allCoords.concat(vertexcoords);
      }
    } else {
      for (const [p, q] of swaps) {
        const [a, b, c, d] = await run("meshgrid-dual-face", { a: p, b: q });
        const vertexcoords = [...a, ...b, ...c, ...a, ...c, ...d];
        allCoords = allCoords.concat(vertexcoords);
      }
      console.log({ allCoords });
    }
    return [new Float32Array(allCoords), swaps.length * 2 * 3];
  }),
);

export const RenderMedialAxis = ({
  dim,
  wireframe,
}: {
  dim: Dim;
  wireframe?: boolean;
}) => {
  const swaps = useAtomValue(swapsForMA(dim));
  const [selected, setSelected] = useAtom(maFaceSelection);

  const [coordBuffer, numberOfVertices] =
    useAtomValue(meshDualFaces(dim)) ?? [];

  const colors = useMemo(() => {
    const blue = [0.53, 0.66, 1.0];
    const red = [1.0, 0.5, 0.5];
    const floats = swaps.flatMap((s) => {
      if (selected && swapHasGridIndices(s, selected.a, selected.b)) {
        return repeat(red, 6);
      } else {
        return repeat(blue, 6);
      }
    });
    return new Float32Array(floats);
  }, [selected, swaps]);
  const colorRef = useRef<THREE.BufferAttribute>(null);
  useLayoutEffect(() => {
    if (!colorRef.current) return;
    colorRef.current.array = new Float32Array(colors);
    colorRef.current.needsUpdate = true;
  }, [colors]);

  const ref = useRef<THREE.BufferAttribute>(null);
  useLayoutEffect(() => {
    if (!ref.current || !coordBuffer) return;
    ref.current.array = coordBuffer;
    ref.current.needsUpdate = true;
  }, [coordBuffer]);

  if (numberOfVertices === 0 || !coordBuffer) return null;

  return (
    <mesh
      key={numberOfVertices}
      onClick={(e) => {
        if (e.faceIndex === undefined) return;
        const i = Math.floor(e.faceIndex / 2);
        const s = swaps[i];
        setSelected({ a: s[0], b: s[1], selection: [] });
        e.stopPropagation();
      }}
    >
      <bufferGeometry attach="geometry">
        <bufferAttribute
          ref={ref}
          attach="attributes-position"
          count={numberOfVertices}
          array={coordBuffer}
          itemSize={3}
        />
        <bufferAttribute
          ref={colorRef}
          attach="attributes-color"
          count={numberOfVertices}
          array={colors}
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
      <meshLambertMaterial vertexColors flatShading side={THREE.DoubleSide} />
      {wireframe && <Wireframe />}
    </mesh>
  );
};
