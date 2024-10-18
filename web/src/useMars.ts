import { useEffect } from "react";
import { mars } from "./global";
import { atom, useSetAtom } from "jotai";
import { VineyardsGrid, VineyardsGridMesh } from "mars_wasm";

/**
 * Incrementing counter that gets incremented every time the mars complex
 * changes.
 */
export const marsComplexTick = atom<number>(0);

export const marsMeshTick = atom<number>(0);

export const marsGrid = atom<VineyardsGrid | VineyardsGridMesh | undefined>(
  (get) => {
    get(marsMeshTick);
    const m = mars();
    return m.grid;
  },
);

export const useMars = () => {
  const setComplex = useSetAtom(marsComplexTick);
  const setMesh = useSetAtom(marsMeshTick);

  useEffect(() => {
    const m = mars();

    m.set_on_complex_change(() =>
      setTimeout(() => {
        setComplex((c) => c + 1);
      }, 0),
    );

    m.set_on_mesh_change(() =>
      setTimeout(() => {
        setMesh((c) => c + 1);
      }, 0),
    );
  }, [setComplex, setMesh]);
};
