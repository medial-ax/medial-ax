import { useAtom, useAtomValue } from "jotai";
import { VineyardsGridMesh } from "mars_wasm";
import { gridRadiusAtom, selectedGridIndex, swapsAtom } from "../state";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

const GRID_COLOR = new THREE.Color(0x888888);
const GRID_SELECTED_COLOR = new THREE.Color(0x000000);

export const RenderVineyardsGridMesh = ({
  grid,
}: {
  grid: VineyardsGridMesh;
}) => {
  const radius = useAtomValue(gridRadiusAtom);

  const _swaps = useAtomValue(swapsAtom);
  const [count, setCount] = useState(0);
  useEffect(() => {
    setTimeout(() => {
      setCount((c) => c + 1);
    }, 10);
  }, [_swaps]);

  const meshref = useRef<THREE.InstancedMesh>(null);

  const points = useMemo(() => {
    if (!grid) return;
    count; // refresh after computing MA
    const coords: [number, number, number][] = [];
    for (const p of grid.points) coords.push([p[0], p[1], p[2]]);
    return coords;
  }, [grid, count]);

  useLayoutEffect(() => {
    const m = meshref.current;
    if (!m || !points) return;

    points.forEach((p, i) => {
      m.setColorAt(i, GRID_COLOR);
      m.setMatrixAt(i, new THREE.Matrix4().makeTranslation(...p));
      m.instanceMatrix.needsUpdate = true;
    });
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [points]);

  const [selGridIndex, setSelGridIndex] = useAtom(selectedGridIndex);
  useLayoutEffect(() => {
    const m = meshref.current;
    if (!m || !selGridIndex || !grid) return;
    const [index] = selGridIndex;

    const ic = m.instanceColor;
    m.setColorAt(index, GRID_SELECTED_COLOR);
    if (ic) ic.needsUpdate = true;

    return () => {
      m.setColorAt(index, GRID_COLOR);
      if (ic) ic.needsUpdate = true;
    };
  }, [grid, selGridIndex]);

  if (!grid || !points) return null;

  return (
    <instancedMesh
      ref={meshref}
      args={[undefined, undefined, points.length]}
      onClick={(e) => {
        // NOTE: We have an implicit camera somewhere, not sure what the parameters actually are.
        const probablyNearClipPlane = 0.1;
        const closest = e.intersections.filter(
          (e) => e.distance > probablyNearClipPlane,
        )[0];
        if (!closest) {
          setSelGridIndex(undefined);
          return;
        }
        const { instanceId } = closest;
        if (instanceId === undefined) return;
        setSelGridIndex([instanceId, 0, 0]);
      }}
    >
      <boxGeometry args={[radius, radius, radius]} />
      <meshBasicMaterial
        side={THREE.DoubleSide}
        attach="material"
        transparent
        opacity={0.5}
      />
    </instancedMesh>
  );
};
