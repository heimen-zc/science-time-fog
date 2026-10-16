import geometry from '../scripts/induction-art/generated/geometry.json';

// Paths and anchors are generated from the audited, settled 3D recorder.
export interface BenchPath {
  d: string;
  kind: string;
  opacity?: number;
}
export interface BenchItem {
  name: string;
  part: string;
  material: string;
  paths: BenchPath[];
}
export const BENCH_GEOMETRY = geometry as unknown as {
  items: BenchItem[];
  anchors: Record<
    'switch' | 'battery' | 'gauge' | 'ring',
    readonly [number, number]
  >;
  gauge: { matrix: string };
  lever: { pivot: number[]; basis: number[][] };
  polarity: number[][];
  field: string[];
  fieldArrows: { positive: string; negative: string }[];
  currentArrows: {
    circuit: 'primary' | 'secondary';
    positive: string;
    negative: string;
  }[];
};
