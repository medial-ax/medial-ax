import { useAtomValue } from "jotai";
import { medialAxesPositions } from "../useMars";
import * as THREE from "three";
import { maWireframeAtom, showMAAtom } from "../state";
import { dim2color } from "../constants";
import { Wireframe } from "@react-three/drei";

const Axis = ({ pos, color }: { pos: Float32Array; color: THREE.Color }) => {
  const maWireframe = useAtomValue(maWireframeAtom);
  return (
    <mesh key={pos.length}>
      <bufferGeometry attach="geometry">
        <bufferAttribute
          attach="attributes-position"
          count={pos.length / 3}
          array={pos}
          itemSize={3}
        />
      </bufferGeometry>
      <meshLambertMaterial flatShading side={THREE.DoubleSide} color={color} />
      {maWireframe && (
        <Wireframe
          stroke={"#000000"}
          backfaceStroke={"#000000"}
          thickness={0.02}
        />
      )}
    </mesh>
  );
};

export const RenderMedialAxis2 = () => {
  const [zeroth, first, second] = useAtomValue(medialAxesPositions);
  const showMA = useAtomValue(showMAAtom);

  return (
    <>
      {zeroth.length && showMA[0] && (
        <Axis pos={zeroth} color={new THREE.Color(dim2color[0])} />
      )}
      {first.length && showMA[1] && (
        <Axis pos={first} color={new THREE.Color(dim2color[1])} />
      )}
      {second.length && showMA[2] && (
        <Axis pos={second} color={new THREE.Color(dim2color[2])} />
      )}
    </>
  );
};
