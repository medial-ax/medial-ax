import { useAtomValue } from "jotai";
import { RenderVineyarsGrid } from "./render/Grid";
import { RenderVineyardsGridMesh } from "./render/GridMesh";
import { marsGrid } from "./useMars";

// const WireframeEdge = ({
//   from,
//   to,
// }: {
//   from: THREE.Vector3;
//   to: THREE.Vector3;
// }) => {
//   const len = from.distanceTo(to);
//   const ref = useRef<THREE.Mesh>(null);
//   useLayoutEffect(() => {
//     if (!ref.current) return;
//
//     const middle = to.clone().add(from).multiplyScalar(0.5);
//     ref.current.position.set(middle.x, middle.y, middle.z);
//
//     ref.current.lookAt(to);
//     ref.current.rotateOnAxis(new THREE.Vector3(1, 0, 0), Math.PI / 2);
//   }, [from, to]);
//
//   return (
//     <mesh position={from} ref={ref}>
//       <cylinderGeometry args={[0.004, 0.004, len]} />
//       <meshLambertMaterial attach="material" color="#000000" />
//     </mesh>
//   );
// };

export const RenderAnyGrid = () => {
  const grid = useAtomValue(marsGrid);
  if (!grid) return null;
  if (grid.type === "grid") return <RenderVineyarsGrid grid={grid} />;
  if (grid.type === "meshgrid") return <RenderVineyardsGridMesh grid={grid} />;
};

// export const RenderMedialAxis = ({
//   dim,
//   wireframe,
// }: {
//   dim: Dim;
//   wireframe?: boolean;
// }) => {
//   const swaps = useAtomValue(swapsForMA(dim));
//   const [selected, setSelected] = useAtom(maFaceSelection);
//
//   const [coordBuffer, numberOfVertices] = useAtomValue(maGridFaces(dim)) ?? [];
//
//   const colors = useMemo(() => {
//     const red = [1.0, 0.5, 0.5];
//     const floats = swaps.flatMap((s) => {
//       if (selected && swapHasGridIndices(s, selected.a, selected.b)) {
//         return repeat(red, 6);
//       } else {
//         return repeat(dim2rgb[dim], 6);
//       }
//     });
//     return new Float32Array(floats);
//   }, [dim, selected, swaps]);
//
//   const colorRef = useRef<THREE.BufferAttribute>(null);
//   useLayoutEffect(() => {
//     if (!colorRef.current) return;
//     colorRef.current.array = new Float32Array(colors);
//     colorRef.current.needsUpdate = true;
//   }, [colors]);
//
//   const ref = useRef<THREE.BufferAttribute>(null);
//   useLayoutEffect(() => {
//     if (!ref.current || !coordBuffer) return;
//     ref.current.array = coordBuffer;
//     ref.current.needsUpdate = true;
//   }, [coordBuffer]);
//
//   if (numberOfVertices === 0 || !coordBuffer) return null;
//
//   return (
//     <mesh
//       key={numberOfVertices}
//       onClick={(e) => {
//         if (e.faceIndex === undefined) return;
//         const i = Math.floor(e.faceIndex / 2);
//         const s = swaps[i];
//         setSelected({ a: s[0], b: s[1], selection: [] });
//         e.stopPropagation();
//       }}
//     >
//       <bufferGeometry attach="geometry">
//         <bufferAttribute
//           ref={ref}
//           attach="attributes-position"
//           count={numberOfVertices}
//           array={coordBuffer}
//           itemSize={3}
//         />
//         <bufferAttribute
//           ref={colorRef}
//           attach="attributes-color"
//           count={numberOfVertices}
//           array={colors}
//           itemSize={3}
//         />
//       </bufferGeometry>
//       <meshBasicMaterial
//         side={THREE.DoubleSide}
//         attach="material"
//         color="#ff0000"
//         transparent
//         opacity={0.5}
//       />
//       <meshLambertMaterial vertexColors flatShading side={THREE.DoubleSide} />
//       {wireframe && <Wireframe />}
//     </mesh>
//   );
// };
