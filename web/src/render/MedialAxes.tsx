import { useAtomValue } from "jotai";
import { medialAxesPositions } from "../useMars";
import * as THREE from "three";

const Axis = ({ pos, color }: { pos: Float32Array; color: THREE.Color }) => {
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
      <meshBasicMaterial
        side={THREE.DoubleSide}
        attach="material"
        color={color}
        transparent
        opacity={0.5}
      />
    </mesh>
  );
};

export const RenderMedialAxis2 = () => {
  const [zeroth, first, second] = useAtomValue(medialAxesPositions);
  console.log({
    zeroth,
    first,
    second,
  });

  return (
    <>
      {zeroth.length && (
        <Axis pos={zeroth} color={new THREE.Color("#ff0000")} />
      )}
      {first.length && <Axis pos={first} color={new THREE.Color("#00ff00")} />}
      {second.length && (
        <Axis pos={second} color={new THREE.Color("#0000ff")} />
      )}
    </>
  );
};
