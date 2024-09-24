import { Grid, Index, Json } from "./types";

export const swapsForDimension = (j: Json, dim: number) => {
  return j.swaps.filter(([, , { v }]) => v[0].dim === dim);
};

/**
 * Returns the center coordinate of the grid cell.
 */
export const gridCoordinate = (grid: Grid, index: Index): number[] => {
  return grid.corner.map((c, i) => c + grid.size * index[i]);
};

type Pos = [number, number, number];
export const dualFaceQuad = (
  grid: Grid,
  a: Index,
  b: Index,
): [Pos, Pos, Pos, Pos] => {
  const pa = gridCoordinate(grid, a);
  const pb = gridCoordinate(grid, b);
  const middle = pa.map((x, i) => (x + pb[i]) / 2);

  const size = grid.size / 2;

  if (a[0] !== b[0]) {
    return [
      [middle[0], middle[1] - size, middle[2] - size], // ll
      [middle[0], middle[1] - size, middle[2] + size], // lr
      [middle[0], middle[1] + size, middle[2] + size], // ur
      [middle[0], middle[1] + size, middle[2] - size], // ul
    ];
  } else if (a[1] !== b[1]) {
    return [
      [middle[0] - size, middle[1], middle[2] - size],
      [middle[0] - size, middle[1], middle[2] + size],
      [middle[0] + size, middle[1], middle[2] + size],
      [middle[0] + size, middle[1], middle[2] - size],
    ];
  } else if (a[2] !== b[2]) {
    return [
      [middle[0] - size, middle[1] - size, middle[2]],
      [middle[0] - size, middle[1] + size, middle[2]],
      [middle[0] + size, middle[1] + size, middle[2]],
      [middle[0] + size, middle[1] - size, middle[2]],
    ];
  } else {
    throw new Error("a == b");
  }
};
