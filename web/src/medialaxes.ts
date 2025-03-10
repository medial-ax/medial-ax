import { VineyardsGrid } from "mars_wasm";
import { Index, Point } from "./types";

/**
 * Returns the coordinate of a grid vertex from its grid {@link Index}
 */
export const gridCoordinate = (grid: VineyardsGrid, index: Index): number[] => {
  return grid.corner.map((c, i) => c + grid.size * index[i]);
};

/**
 * Compute the four quad vertex positions for the dual face of the edge
 * connecting points `a` and `b`
 */
export const dualFaceQuad = (
  grid: VineyardsGrid,
  a: Index,
  b: Index,
): [Point, Point, Point, Point] => {
  const pa = gridCoordinate(grid, a);
  const pb = gridCoordinate(grid, b);
  const middle = pa.map((c, i) => (c + pb[i]) / 2);

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
