import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Spheres } from "./Sphere";

export const Edge = ({
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
      <cylinderGeometry args={[radius, radius, len]} />
      <meshLambertMaterial attach="material" color="#ff0000" />
    </mesh>
  );
};

export const Edges = ({
  positions,
  radius = 0.05,
  pointRadius,
}: {
  positions: [THREE.Vector3, THREE.Vector3][];
  radius?: number;
  pointRadius?: number;
}) => {
  const ref = useRef<THREE.InstancedMesh>(null);

  const endpoints = useMemo(() => positions.flatMap((id) => id), [positions]);

  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    positions.forEach(([from, to], i) => {
      const len = from.distanceTo(to);
      const middle = to.clone().add(from).multiplyScalar(0.5);
      let mat = new THREE.Matrix4().makeTranslation(
        middle.x,
        middle.y,
        middle.z,
      );
      mat = mat.lookAt(from, to, new THREE.Vector3(0, 1, 0));
      const rot = new THREE.Matrix4();
      rot.makeRotationAxis(new THREE.Vector3(1, 0, 0), Math.PI / 2);
      mat = mat.multiply(rot);
      mat = mat.multiply(new THREE.Matrix4().makeScale(1, len, 1));
      m.setMatrixAt(i, mat);
    });
  }, [positions]);

  return (
    <>
      <instancedMesh ref={ref} args={[undefined, undefined, positions.length]}>
        <cylinderGeometry args={[radius, radius, 1]} />
        <meshLambertMaterial attach="material" color="#ea3434" />
      </instancedMesh>
      {pointRadius && <Spheres positions={endpoints} radius={pointRadius} />}
    </>
  );
};
