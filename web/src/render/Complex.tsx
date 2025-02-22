import { useAtomValue } from "jotai";
import {
  complexEdgePositionsAtom,
  complexFacePositionsAtom,
  complexVertexPositionsAtom,
  lifetimesForSimplicesAtom,
} from "../useMars";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { atom } from "jotai";
import {
  highlightAtom,
  objOpacityAtom,
  objWireframeAtom,
  timelinePositionAtom,
} from "../state";
import { Spheres } from "./Sphere";
import { Edges } from "./Edge";
import { Triangles } from "./Triangle";
import { Sphere } from "@react-three/drei";

const vertexHighlights = atom<number[]>((get) => {
  const hl = get(highlightAtom);
  return hl.filter((h) => h.dim === 0).map((h) => h.index);
});

const HighlightedVertices = () => {
  const coords = useAtomValue(complexVertexPositionsAtom);
  const hl = useAtomValue(vertexHighlights);

  const pos = useMemo(() => {
    return hl.map((index) => {
      const x = coords[index * 3];
      const y = coords[index * 3 + 1];
      const z = coords[index * 3 + 2];
      return new THREE.Vector3(x, y, z);
    });
  }, [coords, hl]);

  return <Spheres positions={pos} radius={0.03} />;
};

const edgeHighlights = atom<number[]>((get) => {
  const hl = get(highlightAtom);
  return hl.filter((h) => h.dim === 1).map((h) => h.index);
});

const HighlightedEdges = () => {
  const coords = useAtomValue(complexEdgePositionsAtom);
  const hl = useAtomValue(edgeHighlights);

  const pos = useMemo(() => {
    return hl.map<[THREE.Vector3, THREE.Vector3]>((index) => {
      const x1 = coords[index * 3 + 0];
      const y1 = coords[index * 3 + 1];
      const z1 = coords[index * 3 + 2];
      const x2 = coords[index * 3 + 3];
      const y2 = coords[index * 3 + 4];
      const z2 = coords[index * 3 + 5];
      const from = new THREE.Vector3(x1, y1, z1);
      const to = new THREE.Vector3(x2, y2, z2);
      return [from, to];
    });
  }, [coords, hl]);

  return <Edges positions={pos} radius={0.01} />;
};

const faceHighlights = atom<number[]>((get) => {
  const hl = get(highlightAtom);
  return hl.filter((h) => h.dim === 2).map((h) => h.index);
});

const HighlightedFaces = () => {
  const coords = useAtomValue(complexFacePositionsAtom);
  const hl = useAtomValue(faceHighlights);

  const pos = useMemo(() => {
    return hl.map<[THREE.Vector3, THREE.Vector3, THREE.Vector3]>((index) => {
      const a = new THREE.Vector3(
        coords[index * 9 + 0],
        coords[index * 9 + 1],
        coords[index * 9 + 2],
      );
      const b = new THREE.Vector3(
        coords[index * 9 + 3],
        coords[index * 9 + 4],
        coords[index * 9 + 5],
      );
      const c = new THREE.Vector3(
        coords[index * 9 + 6],
        coords[index * 9 + 7],
        coords[index * 9 + 8],
      );
      return [a, b, c];
    });
  }, [coords, hl]);

  return <Triangles positions={pos} radius={0.01} />;
};

const HighlightTimeline = () => {
  const timeline = useAtomValue(timelinePositionAtom);
  const lifetimes = useAtomValue(lifetimesForSimplicesAtom);

  const vcoords = useAtomValue(complexVertexPositionsAtom);
  const vpositions = useMemo(() => {
    if (!lifetimes) return [];
    const vs: THREE.Vector3[] = [];
    lifetimes[0].forEach((t, i) => {
      if (timeline < t) return;
      const v = new THREE.Vector3(
        vcoords[i * 3 + 0],
        vcoords[i * 3 + 1],
        vcoords[i * 3 + 2],
      );
      vs.push(v);
    });
    return vs;
  }, [lifetimes, timeline, vcoords]);

  const ecoords = useAtomValue(complexEdgePositionsAtom);
  const epositions = useMemo(() => {
    if (!lifetimes) return [];
    const vs: [THREE.Vector3, THREE.Vector3][] = [];
    lifetimes[1].forEach((t, i) => {
      if (timeline < t) return;
      const from = new THREE.Vector3(
        ecoords[i * 6 + 0],
        ecoords[i * 6 + 1],
        ecoords[i * 6 + 2],
      );
      const to = new THREE.Vector3(
        ecoords[i * 6 + 3],
        ecoords[i * 6 + 4],
        ecoords[i * 6 + 5],
      );
      vs.push([from, to]);
    });
    return vs;
  }, [ecoords, lifetimes, timeline]);

  const tcoords = useAtomValue(complexFacePositionsAtom);
  const tpositions = useMemo(() => {
    if (!lifetimes) return [];
    const vs: [THREE.Vector3, THREE.Vector3, THREE.Vector3][] = [];
    lifetimes[2].forEach((t, i) => {
      if (timeline < t) return;
      const a = new THREE.Vector3(
        tcoords[i * 9 + 0],
        tcoords[i * 9 + 1],
        tcoords[i * 9 + 2],
      );
      const b = new THREE.Vector3(
        tcoords[i * 9 + 3],
        tcoords[i * 9 + 4],
        tcoords[i * 9 + 5],
      );
      const c = new THREE.Vector3(
        tcoords[i * 9 + 6],
        tcoords[i * 9 + 7],
        tcoords[i * 9 + 8],
      );
      vs.push([a, b, c]);
    });
    return vs;
  }, [lifetimes, tcoords, timeline]);

  return (
    <>
      {vpositions.length > 0 && (
        <Spheres positions={vpositions} radius={0.01} />
      )}
      {epositions.length > 0 && <Edges positions={epositions} radius={0.005} />}
      {tpositions.length > 0 && (
        <Triangles positions={tpositions} opacity={1} />
      )}
    </>
  );
};

export const RenderComplex2 = (_: { wireframe?: boolean }) => {
  const wireframe = useAtomValue(objWireframeAtom);
  const opacity = useAtomValue(objOpacityAtom);

  const coords = useAtomValue(complexFacePositionsAtom);
  const coords_ref = useRef<number>(0);
  useEffect(() => {
    coords_ref.current += 1;
  }, [coords]);

  const ref = useRef<THREE.BufferAttribute>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    ref.current.array = coords;
    ref.current.needsUpdate = true;
  }, [coords]);

  return (
    <>
      <HighlightedVertices />
      <HighlightedEdges />
      <HighlightedFaces />
      <HighlightTimeline />
      <mesh renderOrder={1}>
        <bufferGeometry attach="geometry">
          <bufferAttribute
            key={coords_ref.current}
            ref={ref}
            attach="attributes-position"
            count={coords.length / 3}
            array={coords}
            itemSize={3}
          />
        </bufferGeometry>
        <meshPhysicalMaterial
          color="#4367ea"
          side={THREE.DoubleSide}
          transparent
          opacity={opacity}
          depthWrite={false}
        />
      </mesh>
      {wireframe && (
        <mesh>
          <wireframeGeometry attach="geometry">
            <bufferAttribute
              key={coords_ref.current}
              ref={ref}
              attach="attributes-position"
              count={coords.length / 3}
              array={coords}
              itemSize={3}
            />
          </wireframeGeometry>
          <meshBasicMaterial
            color="#333"
            side={THREE.DoubleSide}
            transparent
            wireframe
            opacity={opacity / 2}
          />
        </mesh>
      )}
    </>
  );
};

// export const RenderComplex = ({
//   cplx,
//   wireframe,
// }: {
//   cplx: Complex;
//   wireframe?: boolean;
// }) => {
//   const timeline = useAtomValue(timelinePositionAtom);
//
//   const getCoords = useCallback(() => {
//     const [vertices, edges, triangles] = cplx["simplices_per_dim"];
//     const out = triangles.flatMap((t: any) => {
//       const vis: number[] = dedup(
//         t["boundary"].map((ei: number) => edges[ei].boundary).flat(),
//       );
//       const coords = vis.flatMap((i: number) => vertices[i].coords!);
//       return coords;
//     });
//     return new Float32Array(out);
//   }, [cplx]);
//
//   const coords = useMemo(() => getCoords(), [getCoords]);
//
//   const hasSwaps = useAtomValue(hasAnySwaps);
//   const index = useAtomValue(selectedGridIndex);
//   const [filtration, setFiltration] = useState<number[][] | undefined>(
//     undefined,
//   );
//
//   useEffect(() => {
//     if (!index || !hasSwaps) return;
//     let stop = false;
//     run("get-filtration-values-for-point", {
//       grid_point: index,
//     })
//       .then((data) => {
//         if (stop) return;
//         setFiltration(data);
//       })
//       .catch((e) => {
//         window.alert(`bad: ${e.message}`);
//       });
//
//     return () => {
//       stop = true;
//     };
//   }, [hasSwaps, index]);
//
//   const colors = useMemo(() => {
//     const triangles = cplx.simplices_per_dim[2];
//     const gray = [0.953, 0.953, 0.953];
//     const red = [1.0, 0.5, 0.5];
//     if (!filtration) {
//       const n = triangles.length * 3;
//       return new Float32Array(repeat(gray, n));
//     }
//     const floats = triangles.flatMap((_, i: number) => {
//       const value = filtration[2][i];
//       if (value <= timeline) {
//         return repeat(red, 3);
//       } else {
//         return repeat(gray, 3);
//       }
//     });
//     return new Float32Array(floats);
//   }, [cplx.simplices_per_dim, filtration, timeline]);
//
//   const ref = useRef<THREE.BufferAttribute>(null);
//   useLayoutEffect(() => {
//     if (!ref.current) return;
//     ref.current.array = coords;
//     ref.current.needsUpdate = true;
//   }, [coords]);
//
//   const colorRef = useRef<THREE.BufferAttribute>(null);
//   useLayoutEffect(() => {
//     if (!colorRef.current) return;
//     colorRef.current.array = new Float32Array(colors);
//     colorRef.current.needsUpdate = true;
//   }, [colors]);
//
//   const highlights = useAtomValue(highlightAtom);
//
//   const filteredVertices = useMemo(() => {
//     if (!filtration) return [];
//     const n = cplx.simplices_per_dim[0].length;
//     return range(0, n)
//       .filter((i) => filtration[0][i] < timeline)
//       .map((id) => {
//         const pos = cplx.simplices_per_dim[0][id].coords!;
//         return (
//           <Sphere key={id} pos={new THREE.Vector3(...pos)} radius={0.015} />
//         );
//       });
//   }, [cplx.simplices_per_dim, filtration, timeline]);
//
//   const filteredEdges = useMemo(() => {
//     if (!filtration) return [];
//     const n = cplx.simplices_per_dim[1].length;
//     return range(0, n)
//       .filter((i) => filtration[1][i] < timeline)
//       .map((id) => {
//         const edge = cplx.simplices_per_dim[1][id];
//         const p = cplx.simplices_per_dim[0][edge.boundary[0]];
//         const q = cplx.simplices_per_dim[0][edge.boundary[1]];
//         return (
//           <RedEdge
//             key={id}
//             from={new THREE.Vector3(...p.coords!)}
//             to={new THREE.Vector3(...q.coords!)}
//             radius={0.005}
//           />
//         );
//       });
//   }, [cplx.simplices_per_dim, filtration, timeline]);
//
//   const filteredFaces = useMemo(() => {
//     if (!filtration) return [];
//     const n = cplx.simplices_per_dim[2].length;
//     return range(0, n)
//       .filter((i) => filtration[2][i] < timeline)
//       .map((id) => {
//         const face = cplx.simplices_per_dim[2][id];
//         const pointIndices = dedup(
//           face.boundary.flatMap((i) => cplx.simplices_per_dim[1][i].boundary),
//         );
//         const points = pointIndices.map(
//           (i) => new THREE.Vector3(...cplx.simplices_per_dim[0][i].coords!),
//         );
//         return <RedTriangle key={id} points={points} />;
//       });
//   }, [cplx.simplices_per_dim, filtration, timeline]);
//
//   const vertices = highlights
//     .filter((h) => h.dim === 0)
//     .map((h, i) => {
//       const pos = cplx.simplices_per_dim[0][h.index].coords!;
//       return <Sphere key={i} pos={new THREE.Vector3(...pos)} radius={0.03} />;
//     });
//
//   const edges = highlights
//     .filter((h) => h.dim === 1)
//     .map((h, i) => {
//       const edge = cplx.simplices_per_dim[1][h.index];
//       const p = cplx.simplices_per_dim[0][edge.boundary[0]];
//       const q = cplx.simplices_per_dim[0][edge.boundary[1]];
//       return (
//         <RedEdge
//           key={i}
//           from={new THREE.Vector3(...p.coords!)}
//           to={new THREE.Vector3(...q.coords!)}
//           radius={0.02}
//         />
//       );
//     });
//
//   const faces = highlights
//     .filter((h) => h.dim === 2)
//     .map((h, i) => {
//       const face = cplx.simplices_per_dim[2][h.index];
//       const pointIndices = dedup(
//         face.boundary.flatMap((i) => cplx.simplices_per_dim[1][i].boundary),
//       );
//       const points = pointIndices.map(
//         (i) => new THREE.Vector3(...cplx.simplices_per_dim[0][i].coords!),
//       );
//       return <RedTriangle key={i} points={points} />;
//     });
//
//   return null;
//   return (
//     <>
//       <mesh>
//         <bufferGeometry attach="geometry">
//           <bufferAttribute
//             ref={ref}
//             attach="attributes-position"
//             count={coords.length / 3}
//             array={coords}
//             itemSize={3}
//           />
//           <bufferAttribute
//             ref={colorRef}
//             attach="attributes-color"
//             count={colors.length / 3}
//             array={colors}
//             itemSize={3}
//           />
//         </bufferGeometry>
//         <meshLambertMaterial
//           vertexColors
//           color="#f3f3f3"
//           flatShading
//           side={THREE.DoubleSide}
//         />
//         {wireframe &&
//           range(0, cplx.simplices_per_dim[1].length).map((id) => {
//             const edge = cplx.simplices_per_dim[1][id];
//             const p = cplx.simplices_per_dim[0][edge.boundary[0]];
//             const q = cplx.simplices_per_dim[0][edge.boundary[1]];
//             return (
//               <WireframeEdge
//                 key={id}
//                 from={new THREE.Vector3(...p.coords!)}
//                 to={new THREE.Vector3(...q.coords!)}
//               />
//             );
//           })}
//       </mesh>
//       {vertices}
//       {edges}
//       {faces}
//       {filteredVertices}
//       {filteredEdges}
//       {filteredFaces}
//     </>
//   );
// };
