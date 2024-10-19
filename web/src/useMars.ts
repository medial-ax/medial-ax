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

const marsGridTick = atom<number>(0);
export const marsGrid = atom<VineyardsGrid | VineyardsGridMesh | undefined>(
  (get) => {
    get(marsGridTick);
    return mars().grid;
  },
);

const marsVineyardsTick = atom<number>(0);

export const complexFacePositionsAtom = atom<Float32Array>((get) => {
  get(marsComplexTick);
  return new Float32Array(mars().face_positions());
});

export const medialAxesPositions = atom<
  [Float32Array, Float32Array, Float32Array]
>((get) => {
  get(marsVineyardsTick);
  const m = mars();
  return [
    m.medial_axes_face_positions(0),
    m.medial_axes_face_positions(1),
    m.medial_axes_face_positions(2),
  ];
});

export const useMars = () => {
  const setComplex = useSetAtom(marsComplexTick);
  const setGrid = useSetAtom(marsGridTick);
  const setVineyards = useSetAtom(marsVineyardsTick);

  useEffect(() => {
    const m = mars();

    m.set_on_complex_change(() =>
      setTimeout(() => {
        setComplex((c) => c + 1);
      }, 0),
    );

    m.set_on_grid_change(() =>
      setTimeout(() => {
        setGrid((c) => c + 1);
      }, 0),
    );

    m.set_on_vineyards_change(() =>
      setTimeout(() => {
        setVineyards((c) => c + 1);
      }, 0),
    );
  }, [setComplex, setGrid, setVineyards]);
};
