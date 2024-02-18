import { atom } from "jotai";
import { BirthDeathPair, Grid } from "./types";

export const timelinePositionAtom = atom<number>(0);
export const selectedBirthDeathPair = atom<BirthDeathPair | undefined>(
  undefined
);
export const keypointRadiusAtom = atom(0.02);
export const menuOpenAtom = atom(true);

export const complex = atom<any>(undefined);

export const grid = atom<Grid | undefined>(undefined);
export const showGridAtom = atom<boolean>(true);
