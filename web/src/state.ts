import { WritableAtom, atom } from "jotai";
import { BirthDeathPair, Index, PruningParam, Swap, Swaps } from "./types";
import { atomFamily, atomWithReset } from "jotai/utils";
import { Barcode, VineyardsGrid, VineyardsGridMesh } from "mars_wasm";

export const timelinePositionAtom = atom<number>(0);
export const selectedBirthDeathPair = atom<BirthDeathPair | undefined>(
  undefined,
);
export const menuOpenAtom = atom(true);

const gridAtom = atom<VineyardsGrid | VineyardsGridMesh | undefined>(undefined);
export const showGridAtom = atom<boolean>(true);
export const selectedGridIndex = atom<Index | undefined>(undefined);

export const maWireframeAtom = atom<boolean>(false);

export const maFaceSelection = atom<
  | undefined
  | {
      a: Index;
      b: Index;
      selection: Swap["v"][number][];
    }
>(undefined);

export const selectedFaceInfoSwaps = atom<Swap["v"][number][]>([]);

export const highlightAtom = atom<{ dim: number; index: number }[]>((get) => {
  const highlights = [];

  const fs = get(maFaceSelection)?.selection ?? [];
  for (const f of fs) {
    highlights.push({
      dim: f.dim,
      index: f.i,
    });
    highlights.push({
      dim: f.dim,
      index: f.j,
    });
  }

  const fiSwaps = get(selectedFaceInfoSwaps);
  for (const f of fiSwaps) {
    highlights.push({ dim: f.dim, index: f.i });
    highlights.push({ dim: f.dim, index: f.j });
  }

  return highlights;
});

export const gridRadiusAtom = atom<number>(0.02);

export const objWireframeAtom = atom(false);
export const objOpacityAtom = atom(0.8);
export const showObjectAtom = atom(true);

export const swapsAtom = atom<{ 0: Swaps; 1: Swaps; 2: Swaps }>({
  0: [],
  1: [],
  2: [],
});

export type BarcodeType = Barcode;

export type Dim = 0 | 1 | 2;

/**
 * Render the medial axis of dims.
 */
export const showMAAtom = atom<Record<Dim, boolean>>({
  0: true,
  1: true,
  2: true,
});

export const pruningParamAtom = atomFamily((dim: Dim) =>
  atomWithReset<PruningParam>({
    euclidean: true,
    euclidean_distance: 0.01,
    coface: dim == 0 || dim == 2,
    face: 0 < dim,
    persistence: dim == 1,
    persistence_threshold: 0.01,
  }),
);

type AllSettings = {
  grid: VineyardsGrid | VineyardsGridMesh | undefined;
  showGrid: boolean;
  wireframe: boolean;
  showObject: boolean;
  showMedialAxes: Record<Dim, boolean>;
  pruningParamsAtom: Record<Dim, PruningParam>;
};

export const allSettingsAtom: WritableAtom<AllSettings, [AllSettings], void> =
  atom(
    (get) => {
      return {
        grid: get(gridAtom),
        showGrid: get(showGridAtom),
        wireframe: get(objWireframeAtom),
        showObject: get(showObjectAtom),
        showMedialAxes: get(showMAAtom),
        pruningParamsAtom: {
          0: get(pruningParamAtom(0)),
          1: get(pruningParamAtom(1)),
          2: get(pruningParamAtom(2)),
        },
      };
    },
    (_get, set, value: AllSettings) => {
      set(gridAtom, value.grid);
      set(showGridAtom, value.showGrid);
      set(objWireframeAtom, value.wireframe);
      set(showObjectAtom, value.showObject);
      set(showMAAtom, value.showMedialAxes);
      set(pruningParamAtom(0), value.pruningParamsAtom[0]);
      set(pruningParamAtom(1), value.pruningParamsAtom[1]);
      set(pruningParamAtom(2), value.pruningParamsAtom[2]);
    },
  );
