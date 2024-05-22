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
