import geometry from '../scripts/magnet-art/generated/geometry.json';

export interface MagnetPath {
  d: string;
  kind: string;
  opacity?: number;
}
export interface MagnetItem {
  name: string;
  part: string;
  material: string;
  paths: MagnetPath[];
  key: number;
  lift: number;
  moving: boolean;
  text?: { value: string; matrix: string; size: number };
}
export interface MagnetGeometry {
  items: MagnetItem[];
  anchors: Record<'far' | 'near' | 'gauge', readonly [number, number]>;
  travel: readonly [number, number];
  gauge: { matrix: string };
  field: string[];
  arrows: string[];
}
export const MAGNET_GEOMETRY = geometry as unknown as MagnetGeometry;
