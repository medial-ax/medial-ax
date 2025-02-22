import styled from "styled-components";
import "./App.css";
import { Canvas } from "@react-three/fiber";
import { Environment, OrbitControls, Sky } from "@react-three/drei";
import { useEffect, useState } from "react";
import * as THREE from "three";
import { useAtomValue, useSetAtom } from "jotai";
import { BarcodeTabs } from "./Barcode";
import {
  maFaceSelection,
  selectedGridIndex,
  showGridAtom,
  showObjectAtom,
  objWireframeAtom,
} from "./state";
import { RenderAnyGrid } from "./Render";
import { Menu } from "./Controls";
import DragHandle from "./assets/drag-handle.svg";
import { selectedMAFaceAtom, useMars } from "./useMars";
import { RenderComplex2 } from "./render/Complex";
import { Triangle } from "./render/Triangle";
import { Edge } from "./render/Edge";
import { Sphere } from "./render/Sphere";
import { RenderMedialAxis2 } from "./render/MedialAxes";

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

const GrabCorner = styled.div<{ $dragging: boolean }>`
  position: absolute;
  left: 0;
  bottom: 0;
  user-select: none;
  cursor: nesw-resize;
  display: flex;
  padding: 4px;

  svg {
    fill: #333;
    width: 16px;
    height: 16px;
    transform: scale(-1, 1);
  }
`;

const RenderCanvas = () => {
  const wireframe = useAtomValue(objWireframeAtom);
  const [triangle, setTriangle] = useState<THREE.Vector3[] | undefined>(
    undefined,
  );
  const showGrid = useAtomValue(showGridAtom);
  const showObject = useAtomValue(showObjectAtom);
  const setSelectedGridIndex = useSetAtom(selectedGridIndex);
  const setMaFaceSelection = useSetAtom(maFaceSelection);
  const selectMAFace = useSetAtom(selectedMAFaceAtom);

  return (
    <CanvasContainer id="canvas-container">
      <Canvas
        onPointerMissed={(e) => {
          if (e.type !== "click") return;
          setTriangle(undefined);
          setSelectedGridIndex(undefined);
          setMaFaceSelection(undefined);
          selectMAFace(undefined);
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

        <Sky />

        <hemisphereLight
          color={"#718aaa"}
          groundColor="#d2dade"
          intensity={5.0}
        />

        {showObject && <RenderComplex2 wireframe={wireframe} />}

        {showGrid && <RenderAnyGrid />}

        <RenderMedialAxis2 />

        {triangle && (
          <>
            <Triangle points={triangle} />
            <Edge from={triangle[0]} to={triangle[1]} radius={0.01} />
            <Edge from={triangle[1]} to={triangle[2]} radius={0.01} />
            <Edge from={triangle[2]} to={triangle[0]} radius={0.01} />
            <Sphere pos={triangle[0]} radius={0.02} />
            <Sphere pos={triangle[1]} radius={0.02} />
            <Sphere pos={triangle[2]} radius={0.02} />
          </>
        )}

        <Environment preset="warehouse" />
      </Canvas>
    </CanvasContainer>
  );
};

const RenderBarcodeSideThing = () => {
  const [open, setOpen] = useState(false);

  const [size, setSize] = useState({ width: 560, height: 480 });

  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    if (!dragging) return;

    let x0 = 0;
    let y0 = 0;
    function mousemove(e: MouseEvent) {
      if (x0 === 0 && y0 === 0) {
        x0 = e.x;
        y0 = e.y;
      }
      const dx = e.x - x0;
      const dy = e.y - y0;
      setSize((c) => ({
        width: c.width - dx,
        height: c.height + dy,
      }));

      x0 = e.x;
      y0 = e.y;
    }
    function mouseup() {
      window.removeEventListener("mousemove", mousemove);
      setDragging(false);
    }

    window.addEventListener("mousemove", mousemove);
    window.addEventListener("mouseup", mouseup, { once: true });
  }, [dragging]);

  return (
    <>
      <div
        id="barcode"
        aria-hidden={!open}
        style={{
          minWidth: size.width,
          maxWidth: size.width,
          minHeight: size.height,
        }}
      >
        <BarcodeTabs />
        <GrabCorner $dragging={dragging} onMouseDown={() => setDragging(true)}>
          <DragHandle />
        </GrabCorner>
      </div>
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
  useMars();

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
