import { WritableAtom, atom } from "jotai";
import { BirthDeathPair, Grid, PruningParam, Swaps } from "./types";
import { atomFamily, atomWithReset } from "jotai/utils";

export const timelinePositionAtom = atom<number>(0);
export const selectedBirthDeathPair = atom<BirthDeathPair | undefined>(
  undefined,
);
export const keypointRadiusAtom = atom(0.02);
export const menuOpenAtom = atom(true);

export const complexAtom = atom<any>(undefined);

export const gridAtom = atom<Grid | undefined>(undefined);
export const gridForSwapsAtom = atom<Grid | undefined>(undefined);
export const showGridAtom = atom<boolean>(true);

export const gridRadiusAtom = atom<number>(0.02);

export const wireframeAtom = atom(false);
export const showObjectAtom = atom(true);

export const swapsAtom = atom<Swaps>([]);

export const workerRunningAtom = atom<boolean>(false);

export type Dim = 0 | 1 | 2;
export const swapsForMA = atomFamily((dim: Dim) =>
  atom((get) =>
    get(swapsAtom)
      .map(
        (s) =>
          [
            s[0],
            s[1],
            { v: s[2].v.filter((o) => o.dim === dim) },
          ] satisfies Swaps[number],
      )
      .filter((s) => s[2].v.length > 0),
  ),
);

export const showMAAtom = atom<Record<Dim, boolean>>({
  0: true,
  1: true,
  2: true,
});

export const pruningParamAtom = atomFamily((dim: Dim) =>
  atomWithReset<PruningParam>({
    euclidean: true,
    coface: dim == 0 || dim == 2,
    face: 0 < dim,
    persistence: dim == 1,
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
