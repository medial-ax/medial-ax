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
  birth: [number, number] | null;
  death: [number, number] | null;
};

export type Grid = {
  corner: number[];
  size: number;
  shape: number[];
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

  grid: Grid;
  swaps: Swaps;
};

export type PruningParam = {
  euclidean: boolean;
  euclideanDistance?: number;

  coface: boolean;

  face: boolean;

  persistence: boolean;
  persistenceThreshold?: number;
};

// TODO: type this up
export type Complex = any;

export const bboxFromComplex = (cplx: Complex) => {
  const [vertices] = cplx["simplices_per_dim"];
  const coords = vertices.map((v: any) => v.coords);
  const xs = coords.map((c: number[]) => c[0]);
  const ys = coords.map((c: number[]) => c[1]);
  const zs = coords.map((c: number[]) => c[2]);
  const bbox = [
    [Math.min(...xs), Math.min(...ys), Math.min(...zs)],
    [Math.max(...xs), Math.max(...ys), Math.max(...zs)],
  ];
  const scale = Math.min(
    bbox[1][0] - bbox[0][0],
    bbox[1][1] - bbox[0][1],
    bbox[1][2] - bbox[0][2],
  );
  const offset = 0.05 * scale;
  return [bbox[0].map((n) => n - offset), bbox[1].map((n) => n + offset)];
};

export const defaultGrid = (cplx: any, numberOfDots: number = 5) => {
  const bbox = bboxFromComplex(cplx);
  const scales = bbox[1].map((v, i) => v - bbox[0][i]);
  const scale = Math.min(...scales);
  const size = scale / numberOfDots;

  const shape = [
    Math.ceil(scales[0] / size) + 1,
    Math.ceil(scales[1] / size) + 1,
    Math.ceil(scales[2] / size) + 1,
  ];
  return {
    corner: [
      bbox[0][0] - size / 2,
      bbox[0][1] - size / 2,
      bbox[0][2] - size / 2,
    ],
    size,
    shape,
  };
};
