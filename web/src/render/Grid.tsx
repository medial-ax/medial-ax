import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { VineyardsGrid } from "mars_wasm";
import { gridRadiusAtom, selectedGridIndex, swapsAtom } from "../state";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { gridCoordinate } from "../medialaxes";
import * as THREE from "three";
import { currentGridIndex } from "../useMars";

const GRID_COLOR = new THREE.Color(0x444444);
const GRID_SELECTED_COLOR = new THREE.Color(0x437548);

export const RenderVineyarsGrid = ({ grid }: { grid: VineyardsGrid }) => {
  const radius = useAtomValue(gridRadiusAtom);
  const meshref = useRef<THREE.InstancedMesh>(null);
  const _swaps = useAtomValue(swapsAtom);

  const [count, setCount] = useState(0);
  useEffect(() => {
    setTimeout(() => {
      setCount((c) => c + 1);
    }, 10);
  }, [_swaps]);

  const points = useMemo(() => {
    if (!grid) return;
    count; // refresh after computing MA
    const coords: [number, number, number][] = [];
    for (let x = 0; x < grid.shape[0]; x++) {
      for (let y = 0; y < grid.shape[1]; y++) {
        for (let z = 0; z < grid.shape[2]; z++) {
          const c = gridCoordinate(grid, [x, y, z]);
          coords.push([c[0], c[1], c[2]]);
        }
      }
    }
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

  const setCurrentGridIndex = useSetAtom(currentGridIndex);

  const [selGridIndex, setSelGridIndex] = useAtom(selectedGridIndex);
  useLayoutEffect(() => {
    const m = meshref.current;
    if (!m || !selGridIndex || !grid) return;
    // Get the instancedMesh index of the mesh from the grid Index.
    const [x, y, z] = selGridIndex;
    const [, Y, Z] = grid.shape;
    const index = x * Y * Z + y * Z + z;

    const ic = m.instanceColor;
    m.setColorAt(index, GRID_SELECTED_COLOR);
    let mat = new THREE.Matrix4();
    m.getMatrixAt(index, mat);
    const SCALE = 1.5;
    mat = mat.multiply(new THREE.Matrix4().makeScale(SCALE, SCALE, SCALE));
    m.setMatrixAt(index, mat);
    m.instanceMatrix.needsUpdate = true;
    if (ic) ic.needsUpdate = true;

    return () => {
      m.setColorAt(index, GRID_COLOR);
      if (ic) ic.needsUpdate = true;
      let mat = new THREE.Matrix4();
      m.getMatrixAt(index, mat);
      mat = mat.multiply(
        new THREE.Matrix4().makeScale(1 / SCALE, 1 / SCALE, 1 / SCALE),
      );
      m.setMatrixAt(index, mat);
      m.instanceMatrix.needsUpdate = true;
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
        const [, Y, Z] = grid.shape;
        const z = instanceId % Z;
        const y = Math.floor(instanceId / Z) % Y;
        const x = Math.floor(instanceId / Z / Y);
        setSelGridIndex([x, y, z]);
        setCurrentGridIndex([x, y, z]);
        e.stopPropagation();
      }}
    >
      <sphereGeometry args={[radius]} />
      <meshLambertMaterial
        side={THREE.DoubleSide}
        attach="material"
        combine={THREE.MixOperation}
        reflectivity={0.5}
      />
    </instancedMesh>
  );
};
