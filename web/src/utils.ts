import { Index, Swaps } from "./types";

export const sum = <T>(array: T[], key: (t: T) => number): number => {
  let sum = 0;
  for (const x of array) sum += key(x);
  return sum;
};

export const min = (array: number[]): number => {
  let min = Infinity;
  for (const x of array) if (x < min) min = x;
  return min;
};

export const minBy = <T>(array: T[], fn: (t: T) => number): T | undefined => {
  let min = Infinity;
  let obj = undefined;
  for (const x of array) {
    const fnx = fn(x);
    if (fnx < min) {
      min = fnx;
      obj = x;
    }
  }
  return obj;
};

export const max = (array: number[]): number => {
  let max = -Infinity;
  for (const x of array) if (max < x) max = x;
  return max;
};

export const clamp = (x: number, min: number, max: number): number =>
  Math.max(min, Math.min(x, max));

export const dedup = <T>(array: T[]): T[] => Array.from(new Set(array));

export const downloadText = (text: string, filename: string) => {
  const element = document.createElement("a");
  element.setAttribute(
    "href",
    "data:text/plain;charset=utf-8," + encodeURIComponent(text),
  );

  element.setAttribute("download", filename);
  element.style.display = "none";
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
};

export const downloadBinary = (bytes: Uint8Array, filename: string) => {
  const element = document.createElement("a");
  console.log("bytes", bytes.length);
  const blob = new Blob([bytes], { type: "application/msgpack" });
  console.log(blob);
  element.setAttribute("href", URL.createObjectURL(blob));
  element.setAttribute("download", filename);
  element.style.display = "none";
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
};

export const repeat = <T>(array: T[], n: number): T[] => {
  const ret = [];
  for (let i = 0; i < n; i++) {
    ret.push(...array);
  }
  return ret;
};

export const range = (from: number, to: number): number[] => {
  if (to < from) return [];
  const ret = new Array(to - from - 1).fill(0);
  for (let k = 0, i = from; i < to; k++, i++) ret[k] = i;
  return ret;
};

const arreq = <T>(a: T[], b: T[]): boolean => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
};

export const swapHasGridIndices = (swap: Swaps[number], a: Index, b: Index) => {
  return (
    (arreq(swap[0], a) && arreq(swap[1], b)) ||
    (arreq(swap[0], b) && arreq(swap[1], a))
  );
};
