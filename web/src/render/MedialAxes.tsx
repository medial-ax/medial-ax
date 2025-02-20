import { useSetAtom, useAtomValue } from "jotai";
import { medialAxesPositions, selectedMAFaceAtom } from "../useMars";
import * as THREE from "three";
import { maWireframeAtom, showMAAtom } from "../state";
import { dim2color } from "../constants";
import { Wireframe } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";

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
      <meshLambertMaterial flatShading side={THREE.DoubleSide} color={red} />
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
        {maWireframe && (
          <Wireframe
            stroke={"#000000"}
            backfaceStroke={"#000000"}
            thickness={0.02}
          />
        )}
      </mesh>
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
