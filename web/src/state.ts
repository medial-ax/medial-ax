import { WritableAtom, atom } from "jotai";
import {
  BirthDeathPair,
  Complex,
  Grid,
  Index,
  PruningParam,
  Swaps,
} from "./types";
import { atomFamily, atomWithReset } from "jotai/utils";

export const timelinePositionAtom = atom<number>(0);
export const selectedBirthDeathPair = atom<BirthDeathPair | undefined>(
  undefined,
);
export const keypointRadiusAtom = atom(0.02);
export const menuOpenAtom = atom(true);

export const complexAtom = atom<
  | {
      filename: string;
      complex: Complex;
    }
  | undefined
>(undefined);

export const gridAtom = atom<Grid | undefined>(undefined);
export const gridForSwapsAtom = atom<Grid | undefined>(undefined);
export const showGridAtom = atom<boolean>(true);
export const selectedGridIndex = atom<Index | undefined>(undefined);

export const gridOutOfSync = atom((get) => {
  const g1 = get(gridAtom);
  const g2 = get(gridForSwapsAtom);
  return g1 !== g2;
});

export const persistenceTableHighlight = atom<
  | {
      dim: number;
      lower: number | undefined;
      upper: number | undefined;
    }
  | undefined
>(undefined);

export const highlightAtom = atom<{ dim: number; index: number }[]>((get) => {
  const highlights = [];
  const table = get(persistenceTableHighlight);
  if (table) {
    if (table.lower) highlights.push({ dim: table.dim, index: table.lower });
    if (table.upper)
      highlights.push({ dim: table.dim + 1, index: table.upper });
  }
  const sel = get(selectedBirthDeathPair);
  if (sel) {
    if (sel.birth) highlights.push({ dim: sel.dim, index: sel.birth[1] });
    if (sel.death) highlights.push({ dim: sel.dim + 1, index: sel.death[1] });
  }

  return highlights;
});

export const gridRadiusAtom = atom<number>(0.02);

export const wireframeAtom = atom(false);
export const showObjectAtom = atom(true);

export const swapsAtom = atom<{ 0: Swaps; 1: Swaps; 2: Swaps }>({
  0: [],
  1: [],
  2: [],
});

export const hasAnySwaps = atom((get) => {
  const o = get(swapsAtom);
  return o[0].length > 0 || o[1].length > 0 || o[2].length > 0;
});

export const workerRunningAtom = atom<boolean>(false);

export type BarcodeType = {
  "-1": BirthDeathPair[];
  0: BirthDeathPair[];
  1: BirthDeathPair[];
  2: BirthDeathPair[];
};
export const barcodeAtom = atom<BarcodeType | undefined>(undefined);

export type Dim = 0 | 1 | 2;
export const swapsForMA = atomFamily((dim: Dim) =>
  atom((get) => get(swapsAtom)[dim].filter((s) => s[2].v.length > 0)),
);

export const showMAAtom = atom<Record<Dim, boolean>>({
  0: true,
  1: true,
  2: true,
});

export const pruningParamAtom = atomFamily((dim: Dim) =>
  atomWithReset<PruningParam>({
    euclidean: true,
    euclideanDistance: 0.01,
    coface: dim == 0 || dim == 2,
    face: 0 < dim,
    persistence: dim == 1,
    persistenceThreshold: 0.01,
  }),
);

export const allPruningParamsAtom = atom((get) => {
  return {
    0: get(pruningParamAtom(0)),
    1: get(pruningParamAtom(1)),
    2: get(pruningParamAtom(2)),
  };
});

type AllSettings = {
  grid: Grid | undefined;
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
        wireframe: get(wireframeAtom),
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
      set(wireframeAtom, value.wireframe);
      set(showObjectAtom, value.showObject);
      set(showMAAtom, value.showMedialAxes);
      set(pruningParamAtom(0), value.pruningParamsAtom[0]);
      set(pruningParamAtom(1), value.pruningParamsAtom[1]);
      set(pruningParamAtom(2), value.pruningParamsAtom[2]);
    },
  );
