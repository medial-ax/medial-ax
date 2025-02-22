import { useEffect } from "react";
import { mars } from "./global";
import { atom, useSetAtom } from "jotai";
import { Barcode, Index, VineyardsGrid, VineyardsGridMesh } from "mars_wasm";
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

export const marsHasVineyards = atom<boolean>((get) => {
  get(marsVineyardsTick);
  return mars().has_vineyards();
});

export const currentGridIndex = atom<Index | undefined>(undefined);
export const currentBarcode = atom<Barcode | undefined>((get) => {
  get(marsVineyardsTick);
  const gi = get(currentGridIndex);
  if (!gi) return;
  const ret = mars().barcode_for_index(gi);
  return ret;
});

const marsPrunedTick = atom<number>(0);

export const complexVertexPositionsAtom = atom<Float32Array>((get) => {
  get(marsComplexTick);
  return new Float32Array(mars().vertex_positions());
});

export const complexEdgePositionsAtom = atom<Float32Array>((get) => {
  get(marsComplexTick);
  return new Float32Array(mars().edge_positions());
});

export const complexFacePositionsAtom = atom<Float32Array>((get) => {
  get(marsComplexTick);
  return new Float32Array(mars().face_positions());
});

export const medialAxesPositions = atom<
  [Float32Array, Float32Array, Float32Array]
>((get) => {
  get(marsVineyardsTick);
  get(marsPrunedTick);
  const m = mars();
  return [
    m.medial_axes_face_positions(0),
    m.medial_axes_face_positions(1),
    m.medial_axes_face_positions(2),
  ];
});

export const barcodeForCurrentIndexAtom = atom<Barcode | undefined>((get) => {
  const index = get(currentGridIndex);
  if (!index) return;
  get(marsVineyardsTick);
  get(marsPrunedTick);
  const barcode = mars().barcode_for_index(index);
  return barcode;
});

/** Atom set for clicking on a MA face. */
export const selectedMAFaceAtom = atom<{ dim: number; fi: number } | undefined>(
  undefined,
);

/** List of swaps responsible for an MA face. */
export const swapsResponsibleForMAFace = atom((get) => {
  const face = get(selectedMAFaceAtom);
  if (!face) return;
  const ret = mars().swaplist_from_face_index(face.dim, face.fi);
  return ret;
});

export const lifetimesForSimplicesAtom = atom((get) => {
  const index = get(currentGridIndex);
  if (!index) return;
  const ret = mars().lifetimes_for_simplices(index);
  return ret;
});

export const useMars = () => {
  const setComplex = useSetAtom(marsComplexTick);
  const setGrid = useSetAtom(marsGridTick);
  const setVineyards = useSetAtom(marsVineyardsTick);
  const setCurrentGridIndex = useSetAtom(currentGridIndex);
  const setPruned = useSetAtom(marsPrunedTick);

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
        setCurrentGridIndex(undefined);
      }, 0),
    );

    m.set_on_vineyards_change(() =>
      setTimeout(() => {
        setVineyards((c) => c + 1);
      }, 0),
    );

    m.set_on_pruned_change(() =>
      setTimeout(() => {
        setPruned((c) => c + 1);
      }, 0),
    );
  }, [setComplex, setCurrentGridIndex, setGrid, setPruned, setVineyards]);
};
