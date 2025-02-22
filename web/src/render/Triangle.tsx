import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Spheres } from "./Sphere";

export const Triangle = ({ points }: { points: THREE.Vector3[] }) => {
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

/** XY plane */
const UNIT_TRIANGLE = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);

export const Triangles = ({
  positions,
  radius = 0.05,
  opacity,
}: {
  positions: [THREE.Vector3, THREE.Vector3, THREE.Vector3][];
  radius?: number;
  opacity?: number;
}) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const endpoints = useMemo(() => positions.flatMap((id) => id), [positions]);

  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    positions.forEach(([a, b, c], i) => {
      const ab = b.sub(a);
      const ac = c.sub(a);
      const basis = new THREE.Matrix4().makeBasis(
        ab,
        ac,
        new THREE.Vector3(0, 0, 0),
      );
      const trans = new THREE.Matrix4().makeTranslation(a.x, a.y, a.z);

      m.setMatrixAt(i, trans.multiply(basis));
    });
  }, [positions]);

  return (
    <>
      <instancedMesh ref={ref} args={[undefined, undefined, positions.length]}>
        <bufferGeometry attach="geometry">
          <bufferAttribute
            attach="attributes-position"
            count={3}
            array={UNIT_TRIANGLE}
            itemSize={3}
          />
        </bufferGeometry>
        <meshStandardMaterial
          attach="material"
          color="#e15b5b"
          side={THREE.DoubleSide}
          polygonOffset={true}
          polygonOffsetFactor={-2}
          polygonOffsetUnits={1}
          transparent
          opacity={opacity ?? 0.4}
        />
      </instancedMesh>
      <Spheres positions={endpoints} radius={radius * 2} />
    </>
  );
};
