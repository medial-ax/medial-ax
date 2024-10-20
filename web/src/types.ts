import { VineyardsGrid } from "mars_wasm";

export type Point = [number, number, number];

export type Simplex = {
  id: number;
  coords: number[] | null;
  boundary: number[];
};

export type Permutation = {
  forwards: number[];
  backwards: number[];
};

export type BirthDeathPair = {
  dim: number;
  /** [Birth time, simplex index] */
  birth: [number, number] | null;
  /** [Death time, simplex index] */
  death: [number, number] | null;
};

export type Index = [number, number, number];

export type Swap = {
  v: {
    dim: number;
    i: number;
    j: number;
  }[];
};

export type Swaps = [Index, Index, Swap][];

export type Json = {
  vertices: Simplex[];
  edges: Simplex[];
  triangles: Simplex[];

  key_point: number[];

  vertex_ordering: Permutation;
  edge_ordering: Permutation;
  triangle_ordering: Permutation;

  empty_barcode: BirthDeathPair[];
  vertex_barcode: BirthDeathPair[];
  edge_barcode: BirthDeathPair[];
  triangle_barcode: BirthDeathPair[];

  grid: VineyardsGrid;
  swaps: Swaps;
};

export type PruningParam = {
  euclidean: boolean;
  euclidean_distance?: number;

  coface: boolean;

  face: boolean;

  persistence: boolean;
  persistence_threshold?: number;
};

// TODO: type this up
export type Complex = {
  simplices_per_dim: Simplex[][];
};

/**
 * Return the lower- and upper corner of the bounding box around the {@link Complex}.
 */
export const bboxFromComplex = (cplx: Complex): [Point, Point] => {
  const [vertices] = cplx.simplices_per_dim;
  const coords = vertices.map((v) => v.coords!);
  const xs = coords.map((c) => c[0]);
  const ys = coords.map((c) => c[1]);
  const zs = coords.map((c) => c[2]);
  const bbox: [Point, Point] = [
    [Math.min(...xs), Math.min(...ys), Math.min(...zs)],
    [Math.max(...xs), Math.max(...ys), Math.max(...zs)],
  ];
  return [bbox[0], bbox[1]];
};

export const defaultVineyardsGrid = (
  cplx: Complex,
  nVertices: number = 5,
): VineyardsGrid => {
  const bbox = bboxFromComplex(cplx);
  const lengths = bbox[1].map((v, i) => v - bbox[0][i]);
  const shortestLength = Math.min(...lengths);
  const size = shortestLength / (nVertices - 1);

  // NOTE: we have e.g. 5 points along the shortest side, but only 5-1=4 spaces
  // between them. That's why we need the +1 here.
  const shape = [
    Math.ceil(lengths[0] / size) + 1,
    Math.ceil(lengths[1] / size) + 1,
    Math.ceil(lengths[2] / size) + 1,
  ] as [number, number, number];

  // Move the grid slightly so that the center of the grid is the center of the
  // bounding box.
  bbox[0][0] -= ((shape[0] - 1) * size - lengths[0]) / 2;
  bbox[0][1] -= ((shape[1] - 1) * size - lengths[1]) / 2;
  bbox[0][2] -= ((shape[2] - 1) * size - lengths[2]) / 2;

  return {
    type: "grid",
    corner: bbox[0],
    size,
    shape,
  };
};
