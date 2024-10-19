import { useEffect } from "react";
import { mars } from "./global";
import { atom, useSetAtom } from "jotai";
import { VineyardsGrid, VineyardsGridMesh } from "mars_wasm";
import { Complex } from "./types";

const marsComplexTick = atom<number>(0);
export const marsComplex = atom<Complex | undefined>((get) => {
  get(marsComplexTick);
  return mars().complex;
});

const marsMeshTick = atom<number>(0);
export const marsGrid = atom<VineyardsGrid | VineyardsGridMesh | undefined>(
  (get) => {
    get(marsMeshTick);
    const m = mars();
    return m.grid;
  },
);

export const complexFacePositionsAtom = atom<Float32Array>((get) => {
  get(marsComplexTick);
  return new Float32Array(mars().face_positions());
});

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
