import { useAtomValue } from "jotai";
import { complexFacePositionsAtom } from "../state";
import { useEffect, useLayoutEffect, useRef } from "react";
import * as THREE from "three";

export const RenderComplex2 = (_: { wireframe?: boolean }) => {
  const coords = useAtomValue(complexFacePositionsAtom);
  const coords_ref = useRef<number>(0);
  useEffect(() => {
    console.log(coords);
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
      <mesh>
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
        <meshLambertMaterial
          color="#f3f3f3"
          flatShading
          side={THREE.DoubleSide}
        />
      </mesh>
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
