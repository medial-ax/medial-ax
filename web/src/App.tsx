import styled from "styled-components";
import "./App.css";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, TorusKnot, Wireframe } from "@react-three/drei";
import { Dispatch, SetStateAction, useState } from "react";

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

function App() {
  const [wireframe, setWireframe] = useState(false);

  return (
    <>
      <Menu setWireframe={setWireframe} />
      <CanvasContainer id="canvas-container">
        <Canvas>
          <OrbitControls
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
          />
          <color attach="background" args={["white"]} />

          <hemisphereLight
            color={"#ffffff"}
            groundColor="#333"
            intensity={3.0}
          />

          <TorusKnot>
            {wireframe && <Wireframe />}
            <meshLambertMaterial attach="material" color="#f3f3f3" />
          </TorusKnot>
        </Canvas>
      </CanvasContainer>
    </>
  );
}

export default App;
