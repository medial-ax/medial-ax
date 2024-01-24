export const min = (array: number[]): number => {
  let min = Infinity;
  for (const x of array) if (x < min) min = x;
  return min;
};

export const max = (array: number[]): number => {
  let max = -Infinity;
  for (const x of array) if (max < x) max = x;
  return max;
};

export const clamp = (x: number, min: number, max: number): number =>
  Math.max(min, Math.min(x, max));
