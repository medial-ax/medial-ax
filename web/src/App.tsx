import styled from "styled-components";
import "./App.css";
import { Canvas } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";
import { useState } from "react";
import * as THREE from "three";
import { useAtomValue, useSetAtom } from "jotai";
import { BarcodeTabs } from "./Barcode";
import {
  Dim,
  complexAtom,
  gridForSwapsAtom,
  selectedGridIndex,
  showGridAtom,
  showMAAtom,
  showObjectAtom,
  wireframeAtom,
} from "./state";
import {
  RedEdge,
  RedSphere,
  RedTriangle,
  RenderComplex,
  RenderGrid,
  RenderMedialAxis,
} from "./Render";
import { Menu } from "./Controls";

const ToggleBarcodeButton = styled.button`
  position: absolute;
  top: 0;
  right: 0;
  z-index: 10;
  margin: 0.6rem;
  text-overflow: wrap;
  width: 4rem;
`;

const MainContainer = styled.div`
  display: flex;
  flex-direction: row;
  width: 100vw;
  height: 100vh;
`;

const CanvasContainer = styled.div`
  display: flex;
  overflow-x: hidden;
  flex: 1;
`;

const BarcodeContainer = styled.div<{ open: boolean }>`
  display: flex;

  position: absolute;
  top: 2.8rem;
  right: 0;
  z-index: 100;
  margin: 0.6rem;
  width: fit-content;

  transform: ${(p) =>
    !p.open ? "translateX(calc(100% + 1.2rem))" : "translateX(0)"};
  transition: transform 0.2s ease-in-out;

  min-width: 30rem;
  min-height: 30rem;
`;

const RenderCanvas = () => {
  const cplx = useAtomValue(complexAtom);
  const wireframe = useAtomValue(wireframeAtom);
  const [triangle, setTriangle] = useState<THREE.Vector3[] | undefined>(
    undefined,
  );
  const showGrid = useAtomValue(showGridAtom);
  const showObject = useAtomValue(showObjectAtom);
  const showMAs = useAtomValue(showMAAtom);
  const gridForSwaps = useAtomValue(gridForSwapsAtom);
  const setSelectedGridIndex = useSetAtom(selectedGridIndex);

  return (
    <CanvasContainer id="canvas-container">
      <Canvas
        onPointerMissed={(e) => {
          if (e.type !== "click") return;
          setTriangle(undefined);
          setSelectedGridIndex(undefined);
        }}
      >
        <OrbitControls
          dampingFactor={0.1}
          zoomSpeed={0.4}
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
        />
        <color attach="background" args={["#f6f6f6"]} />

        <hemisphereLight color={"#ffffff"} groundColor="#333" intensity={3.0} />

        {cplx && showObject && (
          <RenderComplex
            wireframe={wireframe}
            cplx={cplx.complex}
            key={cplx.filename}
            onClick={() => {}}
          />
        )}

        {showGrid && <RenderGrid />}

        {gridForSwaps &&
          ([0, 1, 2] satisfies Dim[]).map((dim) => {
            if (showMAs[dim])
              return (
                <RenderMedialAxis grid={gridForSwaps} dim={dim} key={dim} />
              );
            return null;
          })}

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
      </Canvas>
    </CanvasContainer>
  );
};

const RenderBarcodeSideThing = () => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <BarcodeContainer open={open}>{open && <BarcodeTabs />}</BarcodeContainer>
      <ToggleBarcodeButton
        onClick={() => {
          setOpen(!open);
        }}
      >
        {open ? "Hide" : "Show"} barcode
      </ToggleBarcodeButton>
    </>
  );
};

function App() {
  return (
    <>
      <MainContainer>
        <Menu />
        <RenderCanvas />
        <RenderBarcodeSideThing />
      </MainContainer>
    </>
  );
}

export default App;
