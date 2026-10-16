/** Dimensionless axial-loop teaching model; the magnet never crosses the coil centre.
 * Position, flux, induced response and the damped meter share this one state.
 * No battery or predetermined pulse is involved: e = -delta(flux) / delta(time).
 */
export type MagnetAction = 'insert' | 'hold' | 'withdraw';
export type MagnetSample = {
  time: number;
  position: number;
  signal: number;
  needle: number;
};
export type MagnetCapture = {
  action: MagnetAction;
  start: number;
  end: number;
  duration: number;
  peak: number;
  signedPeak: number;
  travel: number;
  samples: MagnetSample[];
};
export type MagnetState = {
  position: number;
  flux: number;
  velocity: number;
  emf: number;
  signal: number;
  needle: number;
};

// COSEC: Pointer coordinates are finite, bounded numbers, never CSS or SVG source.
export const magnetPosition = (value: number) =>
  Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
const nearFlux = (0.36 / (0.36 + 0.4 ** 2)) ** 1.5;
export function magnetFlux(position: number): number {
  const distance = 2.8 - magnetPosition(position) * 2.4;
  return (0.36 / (0.36 + distance ** 2)) ** 1.5 / nearFlux;
}
export function initialMagnet(position = 0): MagnetState {
  const x = magnetPosition(position);
  return {
    position: x,
    flux: magnetFlux(x),
    velocity: 0,
    emf: 0,
    signal: 0,
    needle: 0,
  };
}

export function sampleMagnet(
  previous: MagnetState,
  position: number,
  seconds: number,
): MagnetState {
  const next = magnetPosition(position);
  if (!Number.isFinite(seconds) || seconds <= 0) return previous;
  const flux = magnetFlux(next);
  const change = flux - previous.flux;
  const emf = change === 0 ? 0 : -change / seconds;
  // Fixed lead convention: approaching the coil with the N end reads positive.
  const signal = emf === 0 ? 0 : -emf * 0.32;
  const target = signal / (0.6 + Math.abs(signal));
  const needle =
    previous.needle +
    (target - previous.needle) * (1 - Math.exp(-seconds / 0.065));
  return {
    position: next,
    flux,
    velocity: (next - previous.position) / seconds,
    emf,
    signal,
    needle: Math.abs(needle) < 0.0001 && Math.abs(signal) < 0.0001 ? 0 : needle,
  };
}

export function followMagnet(
  previous: MagnetState,
  target: number,
  seconds: number,
): MagnetState {
  const dt = Math.max(1 / 240, Math.min(1 / 20, seconds));
  const gap = magnetPosition(target) - previous.position;
  const step = Math.max(
    -3 * dt,
    Math.min(3 * dt, gap * (1 - Math.exp(-dt / 0.065))),
  );
  const position =
    Math.abs(gap) < 0.0001 ? magnetPosition(target) : previous.position + step;
  return sampleMagnet(previous, position, dt);
}

export function captureMagnet(
  action: MagnetAction,
  samples: MagnetSample[],
): MagnetCapture {
  const first = samples[0] ?? { time: 0, position: 0, signal: 0, needle: 0 };
  const last = samples.at(-1) ?? first;
  const signedPeak = samples.reduce(
    (peak, sample) =>
      Math.abs(sample.signal) > Math.abs(peak) ? sample.signal : peak,
    0,
  );
  return {
    action,
    start: first.position,
    end: last.position,
    duration: Math.max(0, last.time - first.time),
    peak: Math.abs(signedPeak),
    signedPeak,
    travel: samples.reduce(
      (sum, sample, i) =>
        sum + (i ? Math.abs(sample.position - samples[i - 1].position) : 0),
      0,
    ),
    samples: samples.map((sample) => ({
      ...sample,
      time: sample.time - first.time,
    })),
  };
}

export function validMagnetCycle(records: MagnetCapture[]): boolean {
  const approach = records.find((record) => record.action === 'insert');
  const hold = records.find((record) => record.action === 'hold');
  const away = records.find((record) => record.action === 'withdraw');
  return Boolean(
    approach &&
    hold &&
    away &&
    approach.start < 0.025 &&
    approach.end > 0.975 &&
    approach.signedPeak > 0 &&
    hold.start > 0.975 &&
    hold.end > 0.975 &&
    hold.duration >= 1.4 &&
    hold.peak < 0.015 &&
    away.start > 0.975 &&
    away.end < 0.025 &&
    away.signedPeak < 0,
  );
}

export function compareMagnetSpeeds(
  first: MagnetCapture,
  second: MagnetCapture,
): 'confirmed' | 'similar' | 'inconclusive' {
  if (
    first.action !== 'insert' ||
    second.action !== 'insert' ||
    first.start > 0.025 ||
    second.start > 0.025 ||
    first.end < 0.975 ||
    second.end < 0.975 ||
    first.travel > 1.12 ||
    second.travel > 1.12 ||
    first.duration <= 0 ||
    second.duration <= 0
  )
    return 'inconclusive';
  const [fast, slow] =
    first.duration < second.duration ? [first, second] : [second, first];
  if (slow.duration / fast.duration < 1.3) return 'similar';
  return fast.peak > slow.peak * 1.15 ? 'confirmed' : 'inconclusive';
}

export function confirmedMagnetPair(records: MagnetCapture[]): MagnetCapture[] {
  for (let i = 0; i < records.length; i++) {
    for (const second of records.slice(i + 1)) {
      if (compareMagnetSpeeds(records[i], second) === 'confirmed')
        return [records[i], second];
    }
  }
  return [];
}

export function magnetTrace(
  capture: MagnetCapture,
  width = 240,
  height = 70,
): string {
  return capture.samples
    .map((sample, index) => {
      const x = capture.duration ? (sample.time / capture.duration) * width : 0;
      const y =
        height / 2 -
        (sample.signal / (0.6 + Math.abs(sample.signal))) * height * 0.42;
      return `${index ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}
