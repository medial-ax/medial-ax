import styled from "styled-components";
import "./App.css";
import { Canvas } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";
import { useEffect, useState } from "react";
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
import DragHandle from "./assets/drag-handle.svg";

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
        <BarcodeTabs live={open} />
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
