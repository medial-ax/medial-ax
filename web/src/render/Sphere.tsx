import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";

export const Sphere = ({
  pos,
  radius = 0.05,
}: {
  pos: THREE.Vector3;
  radius?: number;
}) => {
  return (
    <mesh position={pos}>
      <sphereGeometry args={[radius]} />
      <meshLambertMaterial attach="material" color="#ff0000" />
    </mesh>
  );
};

export const Spheres = ({
  positions,
  radius = 0.05,
}: {
  positions: THREE.Vector3[];
  radius?: number;
}) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    positions.forEach((p, i) => {
      m.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p));
    });
  }, [positions]);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, positions.length]}>
      <sphereGeometry args={[radius]} />
      <meshLambertMaterial attach="material" color="#ff0000" />
    </instancedMesh>
  );
};
