import styled from "styled-components";
import "./App.css";
import { Canvas } from "@react-three/fiber";
import { Environment, OrbitControls, Wireframe } from "@react-three/drei";
import {
  Dispatch,
  SetStateAction,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import * as THREE from "three";

const CanvasContainer = styled.div`
  width: 100%;
`;

const MenuContainer = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 100;
  display: flex;
  flex-direction: column;
  gap: 1rem;

  background: white;

  border-right: 1px solid #ccc;

  label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem;
    cursor: pointer;
  }
`;

const Menu = ({
  setWireframe,
}: {
  setWireframe: Dispatch<SetStateAction<boolean>>;
}) => {
  return (
    <MenuContainer>
      <h3>Controls</h3>
      <label>
        <p>Wireframe</p>
        <input
          type="checkbox"
          id="menu-toggle"
          onChange={(e) => setWireframe(e.target.checked)}
        />
      </label>
    </MenuContainer>
  );
};

const RedSphere = ({
  pos,
  radius = 0.05,
}: {
  pos: THREE.Vector3;
  radius?: number;
}) => {
  return (
    <mesh position={pos}>
      {/* SphereGeometry(radius : Float, widthSegments : Integer, heightSegments : Integer, phiStart : Float, phiLength : Float, thetaStart : Float, thetaLength : Float) */}
      <sphereGeometry args={[radius]} />
      {/* <pointsMaterial color="#ff0000" /> */}
      <meshLambertMaterial attach="material" color="#ff0000" />
    </mesh>
  );
};

const RedEdge = ({
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
      {/* SphereGeometry(radius : Float, widthSegments : Integer, heightSegments : Integer, phiStart : Float, phiLength : Float, thetaStart : Float, thetaLength : Float) */}
      <cylinderGeometry args={[radius, radius, len]} />
      {/* <pointsMaterial color="#ff0000" /> */}
      <meshLambertMaterial attach="material" color="#ff0000" />
    </mesh>
  );
};

const RedTriangle = ({ points }: { points: THREE.Vector3[] }) => {
  const ref = useRef<THREE.BufferAttribute>(null);

  useLayoutEffect(() => {
    if (!ref.current) return;
    ref.current.array = new Float32Array(
      points.flatMap((p) => [p.x, p.y, p.z])
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

function App() {
  const [wireframe, setWireframe] = useState(false);
  const [triangle, setTriangle] = useState<THREE.Vector3[] | undefined>(
    undefined
  );

  const torus = useRef<THREE.Mesh>(null);

  return (
    <>
      <Menu setWireframe={setWireframe} />
      <CanvasContainer id="canvas-container">
        <Canvas
          onPointerMissed={() => {
            setTriangle(undefined);
          }}
        >
          <OrbitControls
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
          />
          {/* <color attach="background" args={["#f7f9fa"]} /> */}
          <color attach="background" args={["#f6f6f6"]} />

          <hemisphereLight
            color={"#ffffff"}
            groundColor="#333"
            intensity={3.0}
          />

          <mesh
            ref={torus}
            onClick={(e) => {
              if (e.delta === 0) {
                const { a, b, c } = e.face ?? {};
                const vertexBuffer =
                  torus.current?.geometry.getAttribute("position");
                if (vertexBuffer && a && b && c) {
                  setTriangle([
                    new THREE.Vector3(
                      vertexBuffer.array[3 * a + 0],
                      vertexBuffer.array[3 * a + 1],
                      vertexBuffer.array[3 * a + 2]
                    ),
                    new THREE.Vector3(
                      vertexBuffer.array[3 * b + 0],
                      vertexBuffer.array[3 * b + 1],
                      vertexBuffer.array[3 * b + 2]
                    ),
                    new THREE.Vector3(
                      vertexBuffer.array[3 * c + 0],
                      vertexBuffer.array[3 * c + 1],
                      vertexBuffer.array[3 * c + 2]
                    ),
                  ]);
                }
              }
            }}
          >
            <torusKnotGeometry args={[1, 0.3]} />
            <meshLambertMaterial color="#f3f3f3" flatShading />
            {wireframe && <Wireframe />}
          </mesh>
          {/* 
          {(new Array(10).fill(0) as number[]).map((_, i) => {
            const f = (Math.PI * 2 * i) / 10;
            return (
              <RedSphere
                key={i}
                pos={new THREE.Vector3(Math.sin(f), 0, Math.cos(f))}
              />
            );
          })} */}

          {triangle && (
            <>
              <RedTriangle points={triangle} />
              <RedEdge from={triangle[0]} to={triangle[1]} radius={0.01} />
              <RedEdge from={triangle[1]} to={triangle[2]} radius={0.01} />
              <RedEdge from={triangle[2]} to={triangle[0]} radius={0.01} />
              <RedSphere pos={triangle[0]} radius={0.02} />
              <RedSphere pos={triangle[1]} radius={0.02} />
              <RedSphere pos={triangle[2]} radius={0.02} />
            </>
          )}

          <Environment preset="warehouse" />
          {/* <TorusKnot>
            {wireframe && <Wireframe />}
            <meshLambertMaterial attach="material" color="#f3f3f3" />
          </TorusKnot> */}
        </Canvas>
      </CanvasContainer>
    </>
  );
}

export default App;
