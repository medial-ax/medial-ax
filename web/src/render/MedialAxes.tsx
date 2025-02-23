import { useSetAtom, useAtomValue } from "jotai";
import { medialAxesPositions, selectedMAFaceAtom } from "../useMars";
import * as THREE from "three";
import { maWireframeAtom, showMAAtom } from "../state";
import { dim2color } from "../constants";
import { useEffect, useMemo, useRef } from "react";
import { Edges } from "./Edge";

const red = new THREE.Color(0xff0000);

const SelectedFace = () => {
  const posArray = useAtomValue(medialAxesPositions);
  const selectedMAFace = useAtomValue(selectedMAFaceAtom);
  const counter = useRef<number>(0);
  useEffect(() => {
    counter.current += 1;
  }, [selectedMAFace]);

  if (!selectedMAFace) return null;

  const { dim, fi } = selectedMAFace;
  const pos = posArray[dim].slice(fi * 9, fi * 9 + 3 * 6);
  return (
    <mesh>
      <bufferGeometry attach="geometry">
        <bufferAttribute
          key={counter.current}
          attach="attributes-position"
          count={6}
          array={pos}
          itemSize={3}
        />
      </bufferGeometry>
      <meshStandardMaterial
        side={THREE.DoubleSide}
        color={red}
        polygonOffset={true}
        polygonOffsetFactor={-1}
        polygonOffsetUnits={1}
        transparent
        opacity={0.7}
      />
    </mesh>
  );
};

const Axis = ({ dim, pos }: { dim: number; pos: Float32Array }) => {
  const color = useMemo(() => new THREE.Color(dim2color[dim]), [dim]);
  const counter = useRef<number>(0);
  useEffect(() => {
    counter.current += 1;
  }, [pos]);

  const selectMAFace = useSetAtom(selectedMAFaceAtom);

  const maWireframe = useAtomValue(maWireframeAtom);
  const wireframePos = useMemo(() => {
    if (!maWireframe) return undefined;

    const edges: [THREE.Vector3, THREE.Vector3][] = [];
    for (let i = 0; i < pos.length; i += 18) {
      const a = new THREE.Vector3(pos[i + 0], pos[i + 1], pos[i + 2]);
      const b = new THREE.Vector3(pos[i + 3], pos[i + 4], pos[i + 5]);
      const c = new THREE.Vector3(pos[i + 6], pos[i + 7], pos[i + 8]);
      const d = new THREE.Vector3(pos[i + 15], pos[i + 16], pos[i + 17]);

      edges.push([a, b]);
      edges.push([b, c]);
      edges.push([c, d]);
      edges.push([d, a]);
    }

    return edges;
  }, [maWireframe, pos]);

  return (
    <>
      <mesh
        key={pos.length}
        onClick={(e) => {
          let fi = e.faceIndex;
          if (fi === undefined) return;
          fi = fi & ~1; // round down to choose the first triangle
          selectMAFace({ dim, fi });
          e.stopPropagation();
        }}
      >
        <bufferGeometry attach="geometry">
          <bufferAttribute
            key={counter.current}
            attach="attributes-position"
            count={pos.length / 3}
            array={pos}
            itemSize={3}
          />
        </bufferGeometry>
        <meshLambertMaterial
          flatShading
          side={THREE.DoubleSide}
          color={color}
        />
      </mesh>
      {wireframePos && (
        <Edges
          key={wireframePos.length}
          positions={wireframePos}
          color="#000000"
          radius={0.001}
        />
      )}
    </>
  );
};

export const RenderMedialAxis2 = () => {
  const [zeroth, first, second] = useAtomValue(medialAxesPositions);
  const showMA = useAtomValue(showMAAtom);

  return (
    <>
      <SelectedFace />
      {zeroth.length && showMA[0] && <Axis dim={0} pos={zeroth} />}
      {first.length && showMA[1] && <Axis dim={1} pos={first} />}
      {second.length && showMA[2] && <Axis dim={2} pos={second} />}
    </>
  );
};
