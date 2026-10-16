/* oxlint-disable jsx-a11y/prefer-tag-over-role -- This animated inline SVG needs native path refs and accessible image semantics. */
import { BENCH_GEOMETRY } from '../lib/induction-bench-geometry';
import type { BenchItem } from '../lib/induction-bench-geometry';
import '../scripts/induction-art/bench.css';

export const BENCH_ANCHORS = BENCH_GEOMETRY.anchors;

export interface BenchFrame {
  closed: number;
  polarity: 1 | -1;
  needle: number;
  flux: number;
  field: boolean;
  primary: number;
  secondary: number;
}

function Part({ item }: { item: BenchItem }) {
  const moving =
    item.name === 'switch.blade'
      ? 'blade'
      : item.name === 'switch.grip'
        ? 'grip'
        : undefined;
  const circuit =
    item.part === 'primary' ||
    item.part === 'primary-lead' ||
    item.name.startsWith('battery.supplyStrap:')
      ? 'primary'
      : item.part === 'secondary' || item.part === 'secondary-lead'
        ? 'secondary'
        : undefined;
  return (
    <g
      data-part={item.part}
      data-piece={item.name}
      data-bench-moving={moving}
      className={`bench-material-${item.material}`}
    >
      {item.paths.map((path, index) => {
        const lineClass = [
          'line',
          'slot',
          'groove',
          'scale',
          'tick',
          'zero',
        ].includes(path.kind)
          ? ' iso-line'
          : '';
        return (
          <g key={index}>
            <path
              d={path.d}
              className={`bench-${path.kind}${lineClass}`}
              opacity={path.opacity}
            />
            {circuit && path.kind === 'tube-shine' && (
              <path d={path.d} className={`bench-current-${circuit}`} />
            )}
          </g>
        );
      })}
    </g>
  );
}

/** Static escaped JSX art; the parent owns the animation clock and controls. */
export function InductionBench() {
  return (
    <svg
      className="iso-svg induction-bench"
      viewBox="0 0 960 540"
      role="img"
      aria-label="法拉第感应环实验装置"
    >
      <title>法拉第感应环：同一铁环上的两个独立线圈</title>
      <desc>
        左侧电池通过刀闸连接初级线圈。右侧次级线圈只连接中央为零的检流计，两个电路彼此绝缘。
      </desc>
      <g className="bench-scene">
        {BENCH_GEOMETRY.items.map((item) => (
          <Part key={item.name} item={item} />
        ))}
      </g>
      <g aria-hidden="true">
        {(BENCH_GEOMETRY.currentArrows ?? []).map((arrow) => (
          <g key={arrow.circuit} className={`bench-current-${arrow.circuit}`}>
            <path
              d={arrow.positive}
              data-bench-current-arrow={arrow.circuit}
              data-sign="positive"
            />
            <path
              d={arrow.negative}
              data-bench-current-arrow={arrow.circuit}
              data-sign="negative"
            />
          </g>
        ))}
      </g>
      <g data-bench-field="" opacity="0" aria-hidden="true">
        {BENCH_GEOMETRY.field.map((d, index) => (
          <path key={index} d={d} className="bench-field-line" />
        ))}
        {BENCH_GEOMETRY.fieldArrows.map((arrow, index) => (
          <g key={index}>
            <path
              d={arrow.positive}
              data-bench-arrow="positive"
              className="bench-field-arrow"
            />
            <path
              d={arrow.negative}
              data-bench-arrow="negative"
              className="bench-field-arrow"
              opacity="0"
            />
          </g>
        ))}
      </g>
      <g transform={BENCH_GEOMETRY.gauge.matrix} data-bench-gauge-face="">
        <text x="0" y="-25" textAnchor="middle" className="bench-zero-label">
          0
        </text>
        <text x="-27" y="-10" textAnchor="middle" className="bench-scale-sign">
          −
        </text>
        <text x="27" y="-10" textAnchor="middle" className="bench-scale-sign">
          +
        </text>
        <g data-bench-needle="" transform="rotate(0)">
          <path
            d="M-1.7 8 L-0.9 -32 L0 -37 L0.9 -32 L1.7 8 Z"
            className="bench-needle"
          />
        </g>
        <circle r="3.4" className="bench-hub" />
      </g>
      <g
        data-bench-polarity=""
        transform={`translate(${BENCH_GEOMETRY.polarity[0].join(' ')})`}
        aria-hidden="true"
      >
        <circle r="4.1" className="bench-polarity-disc" />
        <path d="M-2 0H2M0 -2V2" className="bench-polarity-mark" />
      </g>
    </svg>
  );
}

const bounded = (n: number, low: number, high: number) =>
  Number.isFinite(n) ? Math.max(low, Math.min(high, n)) : 0;

/** Call once after mount. Returned function performs no DOM queries or React updates. */
export function bindBench(
  root: Pick<ParentNode, 'querySelector' | 'querySelectorAll'>,
): (frame: BenchFrame) => void {
  const svg =
    root.querySelector<SVGSVGElement>('.induction-bench') ??
    (root instanceof SVGSVGElement && root.matches('.induction-bench')
      ? root
      : null);
  const needle = root.querySelector<SVGGElement>('[data-bench-needle]');
  const field = root.querySelector<SVGGElement>('[data-bench-field]');
  const blade = Array.from(
    root.querySelectorAll<SVGPathElement>('[data-bench-moving="blade"] path'),
  );
  const handle = Array.from(
    root.querySelectorAll<SVGPathElement>('[data-bench-moving="grip"] path'),
  );
  const positiveArrows = Array.from(
    root.querySelectorAll<SVGPathElement>('[data-bench-arrow="positive"]'),
  );
  const negativeArrows = Array.from(
    root.querySelectorAll<SVGPathElement>('[data-bench-arrow="negative"]'),
  );
  const polarity = root.querySelector<SVGGElement>('[data-bench-polarity]');
  const { pivot, basis } = BENCH_GEOMETRY.lever;
  const project = (x: number, y: number, z: number) => [
    pivot[0] + x * basis[0][0] + y * basis[1][0] + z * basis[2][0],
    pivot[1] + x * basis[0][1] + y * basis[1][1] + z * basis[2][1],
  ];
  const polygon = (points: number[][]) =>
    points
      .map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(2)} ${p[1].toFixed(2)}`)
      .join('') + 'Z';
  return (frame) => {
    const closed = bounded(frame.closed, 0, 1);
    // The parent supplies an eased continuous closed fraction. Reproject the
    // three true prism faces; a screen rotation would distort the hinge plane.
    const angle = (1 - closed) * Math.PI * 0.29;
    const point = (x: number, y: number, z: number) =>
      project(
        x * Math.cos(angle) - z * Math.sin(angle),
        y,
        x * Math.sin(angle) + z * Math.cos(angle),
      );
    const box = (
      from: number,
      to: number,
      width: number,
      bottom: number,
      top: number,
    ) => [
      polygon([
        point(from, -width, top),
        point(to, -width, top),
        point(to, width, top),
        point(from, width, top),
      ]),
      polygon([
        point(from, width, bottom),
        point(to, width, bottom),
        point(to, width, top),
        point(from, width, top),
      ]),
      polygon([
        point(to, -width, bottom),
        point(to, width, bottom),
        point(to, width, top),
        point(to, -width, top),
      ]),
    ];
    box(0, 54, 3, 0, 1.6).forEach((d, index) =>
      blade[index]?.setAttribute('d', d),
    );
    box(50, 69, 5.5, 1.6, 6.6).forEach((d, index) =>
      handle[index]?.setAttribute('d', d),
    );
    needle?.setAttribute(
      'transform',
      `rotate(${(bounded(frame.needle, -1, 1) * 62).toFixed(3)})`,
    );
    field?.setAttribute(
      'opacity',
      String(
        frame.field
          ? Math.min(0.82, Math.abs(bounded(frame.flux, -1, 1)) * 0.82)
          : 0,
      ),
    );
    field?.setAttribute(
      'data-direction',
      frame.flux < 0 ? 'negative' : 'positive',
    );
    positiveArrows.forEach((el) =>
      el.setAttribute('opacity', frame.flux < 0 ? '0' : '1'),
    );
    negativeArrows.forEach((el) =>
      el.setAttribute('opacity', frame.flux < 0 ? '1' : '0'),
    );
    polarity?.setAttribute('data-polarity', String(frame.polarity));
    polarity?.setAttribute(
      'transform',
      `translate(${BENCH_GEOMETRY.polarity[frame.polarity === -1 ? 1 : 0].join(' ')})`,
    );
    svg?.style.setProperty(
      '--bench-primary',
      String(Math.abs(bounded(frame.primary, -1, 1))),
    );
    svg?.style.setProperty(
      '--bench-secondary',
      String(Math.abs(bounded(frame.secondary, -1, 1))),
    );
    svg?.setAttribute(
      'data-primary-direction',
      frame.primary < 0 ? 'negative' : 'positive',
    );
    svg?.setAttribute(
      'data-secondary-direction',
      frame.secondary < 0 ? 'negative' : 'positive',
    );
  };
}
