/* oxlint-disable jsx-a11y/prefer-tag-over-role -- Animated inline SVG requires image semantics and cached native path refs. */
import { MAGNET_GEOMETRY } from '../lib/magnet-bench-geometry';
import type { MagnetItem } from '../lib/magnet-bench-geometry';
import '../scripts/magnet-art/magnet.css';

export const MAGNET_ANCHORS = MAGNET_GEOMETRY.anchors;
export interface MagnetBenchFrame {
  position: number;
  needle: number;
  signal: number;
  flux: number;
  field: boolean;
}

function Part({ item }: { item: MagnetItem }) {
  const conducting = item.part === 'winding' || item.part === 'lead';
  return (
    <g
      data-magnet-item={item.name}
      data-part={item.part}
      data-magnet-slide={item.moving ? '' : undefined}
      className={`bench-material-${item.material}`}
    >
      {item.paths.map((path, index) => (
        <g key={index}>
          <path
            d={path.d}
            className={`bench-${path.kind}${['line', 'slot', 'groove', 'scale', 'tick', 'zero'].includes(path.kind) ? ' iso-line' : ''}`}
            opacity={path.opacity}
          />
          {conducting && path.kind === 'tube-shine' && (
            <path d={path.d} className="magnet-current" />
          )}
        </g>
      ))}
      {item.text && (
        <text
          transform={item.text.matrix}
          className="magnet-pole-stamp"
          textAnchor="middle"
          fontSize={item.text.size}
        >
          {item.text.value}
        </text>
      )}
    </g>
  );
}

/** Parent-owned motion and physics; static, escaped SVG artwork only. */
export function MagnetBench() {
  return (
    <svg
      className="iso-svg magnet-bench"
      viewBox="0 0 960 540"
      role="img"
      aria-label="导轨上的棒磁铁与空心线圈实验装置"
    >
      <title>棒磁铁沿导轨靠近空心线圈，线圈与检流计闭合连接</title>
      <g data-magnet-scene="">
        {MAGNET_GEOMETRY.items.map((item) => (
          <Part key={item.name} item={item} />
        ))}
      </g>
      <g data-magnet-field="" opacity="0" aria-hidden="true">
        {(MAGNET_GEOMETRY.field ?? []).map((d, index) => (
          <path key={index} d={d} className="magnet-field-line" />
        ))}
        {(MAGNET_GEOMETRY.arrows ?? []).map((d, index) => (
          <path key={index} d={d} className="magnet-field-arrow" />
        ))}
      </g>
      <g transform={MAGNET_GEOMETRY.gauge.matrix}>
        <text x="0" y="-25" className="bench-zero-label" textAnchor="middle">
          0
        </text>
        <text x="-27" y="-10" className="bench-scale-sign" textAnchor="middle">
          −
        </text>
        <text x="27" y="-10" className="bench-scale-sign" textAnchor="middle">
          +
        </text>
        <g data-magnet-needle="" transform="rotate(0)">
          <path
            d="M-1.7 8L-.9 -32L0 -37L.9 -32L1.7 8Z"
            className="bench-needle"
          />
        </g>
        <circle r="3.4" className="bench-hub" />
      </g>
    </svg>
  );
}

const clamp = (value: number, low: number, high: number) =>
  Number.isFinite(value) ? Math.min(high, Math.max(low, value)) : 0;

/** Query once; all slide parts use the same projected translation and depth. */
export function bindMagnetBench(
  root: Pick<ParentNode, 'querySelector' | 'querySelectorAll'>,
): (frame: MagnetBenchFrame) => void {
  const svg =
    root.querySelector<SVGSVGElement>('.magnet-bench') ??
    (root instanceof SVGSVGElement && root.matches('.magnet-bench')
      ? root
      : null);
  const scene = root.querySelector<SVGGElement>('[data-magnet-scene]');
  const nodes = Array.from(
    root.querySelectorAll<SVGGElement>('[data-magnet-item]'),
  );
  const byName = new Map(
    MAGNET_GEOMETRY.items.map((item) => [item.name, item]),
  );
  const items = nodes.map((node) => ({
    node,
    item: byName.get(node.getAttribute('data-magnet-item') ?? ''),
  }));
  const moving = items
    .filter(({ item }) => item?.moving)
    .sort((a, b) => (a.item?.key ?? 0) - (b.item?.key ?? 0));
  const fixed = items
    .filter(({ item }) => !item?.moving)
    .sort((a, b) => (a.item?.key ?? 0) - (b.item?.key ?? 0));
  const slides = moving.map(({ node }) => node);
  const needle = root.querySelector<SVGGElement>('[data-magnet-needle]');
  const field = root.querySelector<SVGGElement>('[data-magnet-field]');
  const [dx, dy] = MAGNET_GEOMETRY.travel;
  const slot = (key: number) => {
    let low = 0,
      high = fixed.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if ((fixed[mid].item?.key ?? 0) <= key) low = mid + 1;
      else high = mid;
    }
    return low;
  };
  let slots = moving.map(({ item }) => slot(item?.key ?? 0));
  let lastPosition = -1;
  return (frame) => {
    const position = clamp(frame.position, 0, 1);
    const translation = `translate(${(dx * position).toFixed(4)} ${(dy * position).toFixed(4)})`;
    if (position !== lastPosition) {
      slides.forEach((node) => node.setAttribute('transform', translation));
      field?.setAttribute('transform', translation);
      const next = moving.map(({ item }) =>
        slot((item?.key ?? 0) + (item?.lift ?? 0) * position),
      );
      // Fixed geometry never changes order. Move just the 13 carriage parts
      // when a measured depth boundary changes, instead of rebuilding the SVG.
      if (scene && next.some((value, index) => value !== slots[index])) {
        moving.forEach(({ node }, index) =>
          scene.insertBefore(node, fixed[next[index]]?.node ?? null),
        );
        slots = next;
      }
      lastPosition = position;
    }
    needle?.setAttribute(
      'transform',
      `rotate(${(clamp(frame.needle, -1, 1) * 62).toFixed(3)})`,
    );
    field?.setAttribute(
      'opacity',
      String(frame.field ? 0.15 + clamp(frame.flux, 0, 1) * 0.65 : 0),
    );
    svg?.style.setProperty(
      '--magnet-signal',
      String(Math.abs(clamp(frame.signal, -1, 1))),
    );
    svg?.setAttribute(
      'data-signal-direction',
      frame.signal < 0 ? 'negative' : 'positive',
    );
  };
}
