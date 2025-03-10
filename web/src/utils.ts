export const sum = <T>(array: T[], key: (t: T) => number): number => {
  let sum = 0;
  for (const x of array) sum += key(x);
  return sum;
};

export const max = (array: number[]): number => {
  let max = -Infinity;
  for (const x of array) if (max < x) max = x;
  return max;
};

export const clamp = (x: number, min: number, max: number): number =>
  Math.max(min, Math.min(x, max));

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

export const range = (from: number, to: number): number[] => {
  if (to < from) return [];
  const ret = new Array(to - from - 1).fill(0);
  for (let k = 0, i = from; i < to; k++, i++) ret[k] = i;
  return ret;
};
