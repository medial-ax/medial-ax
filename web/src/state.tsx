import { atom } from "jotai";
import { BirthDeathPair, Grid, Swaps } from "./types";
import { atomFamily } from "jotai/utils";

export const timelinePositionAtom = atom<number>(0);
export const selectedBirthDeathPair = atom<BirthDeathPair | undefined>(
  undefined
);
export const keypointRadiusAtom = atom(0.02);
export const menuOpenAtom = atom(true);

export const complex = atom<any>(undefined);

export const grid = atom<Grid | undefined>(undefined);
export const showGridAtom = atom<boolean>(true);

export const gridRadiusAtom = atom<number>(0.02);

export const wireframeAtom = atom(false);

export const swapsAtom = atom<Swaps>([]);

export type Dim = 0 | 1 | 2;
export const swapsForMA = atomFamily((dim: Dim) => atom((get) =>
  get(swapsAtom).map(s =>
    [s[0], s[1], { v: s[2].v.filter(o => o.dim === dim) }] satisfies Swaps[number]
  ).filter(s => s[2].v.length > 0)
));

export const showMA = atom<Partial<Record<Dim, boolean>>>({})
