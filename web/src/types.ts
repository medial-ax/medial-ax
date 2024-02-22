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
