import { atom } from "jotai";
import { BirthDeathPair, Grid, PruningParam, Swaps } from "./types";
import { atomFamily, atomWithReset } from "jotai/utils";

export const timelinePositionAtom = atom<number>(0);
export const selectedBirthDeathPair = atom<BirthDeathPair | undefined>(
  undefined
);
export const keypointRadiusAtom = atom(0.02);
export const menuOpenAtom = atom(true);

export const complexAtom = atom<any>(undefined);

export const gridAtom = atom<Grid | undefined>(undefined);
export const showGridAtom = atom<boolean>(true);

export const gridRadiusAtom = atom<number>(0.02);

export const wireframeAtom = atom(false);
export const showObjectAtom = atom(true);

export const swapsAtom = atom<Swaps>([]);

export const workerRunningAtom = atom<boolean>(false);

export type Dim = 0 | 1 | 2;
export const swapsForMA = atomFamily((dim: Dim) => atom((get) =>
  get(swapsAtom).map(s =>
    [s[0], s[1], { v: s[2].v.filter(o => o.dim === dim) }] satisfies Swaps[number]
  ).filter(s => s[2].v.length > 0)
));

export const showMAAtom = atom<Partial<Record<Dim, boolean>>>({
  0: true,
  1: true,
  2: true,
})

export const pruningParamAtom = atomFamily((dim: Dim) => atomWithReset<PruningParam>({
  euclidean: true,
  coface: dim == 0 || dim == 2,
  face: 0 < dim,
  persistence: dim == 1,
}))
