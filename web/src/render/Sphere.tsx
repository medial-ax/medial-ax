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
