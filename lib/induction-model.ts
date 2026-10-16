/**
 * A deliberately slowed, dimensionless teaching model, not a calibrated meter.
 * The flux transient and induced EMF are one analytic pair (e = -dPhi/dt).
 * The galvanometer is damped, so its pointer follows rather than jumps.
 */
export type RingAction = 'connect' | 'hold' | 'disconnect';
export type BatteryPolarity = 'normal' | 'reversed';
export type InductionFrame = {
  closed: number;
  polarity: 1 | -1;
  needle: number;
  flux: number;
  field: boolean;
  primary: number;
  secondary: number;
  emf: number;
};
export type DiscoveryRecord = {
  id: number;
  action: RingAction;
  polarity: BatteryPolarity;
  direction: 'left' | 'right' | 'none';
  peak: number;
};

export const TRANSIENT_SECONDS = 2.8;
export const FLUX_TIME = 0.34;
const POINTER_RISE = 0.12;
const POINTER_FALL = 0.62;
export const PEAK_TIME =
  Math.log(POINTER_FALL / POINTER_RISE) / (1 / POINTER_RISE - 1 / POINTER_FALL);
const POINTER_PEAK =
  Math.exp(-PEAK_TIME / POINTER_FALL) - Math.exp(-PEAK_TIME / POINTER_RISE);

export function polaritySign(polarity: BatteryPolarity): 1 | -1 {
  return polarity === 'normal' ? 1 : -1;
}

export function inductionAt(
  action: RingAction,
  polarity: BatteryPolarity,
  seconds: number,
  field = false,
): InductionFrame {
  const sign = polaritySign(polarity);
  const age = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const closing = action !== 'disconnect';
  const steady = action === 'hold' || age >= TRANSIENT_SECONDS;
  const decay = steady ? 0 : Math.exp(-age / FLUX_TIME);
  const flux = sign * (closing ? 1 - decay : decay);
  const emf = steady ? 0 : (-(closing ? sign : -sign) * decay) / FLUX_TIME;
  // The galvanometer's fixed lead convention makes a normal closing pulse positive.
  const secondary = steady ? 0 : -emf * FLUX_TIME;
  const pointer = steady
    ? 0
    : (Math.exp(-age / POINTER_FALL) - Math.exp(-age / POINTER_RISE)) /
      POINTER_PEAK;
  return {
    closed: closing ? 1 : 0,
    polarity: sign,
    needle: Math.max(-1, Math.min(1, (closing ? sign : -sign) * pointer)),
    flux,
    field,
    primary: closing ? sign : 0,
    secondary,
    emf,
  };
}

export function restingFrame(
  polarity: BatteryPolarity = 'normal',
): InductionFrame {
  return inductionAt('disconnect', polarity, TRANSIENT_SECONDS);
}

export function observationFor(
  action: RingAction,
  polarity: BatteryPolarity,
  id: number,
): DiscoveryRecord {
  const peak = inductionAt(
    action,
    polarity,
    action === 'hold' ? TRANSIENT_SECONDS : PEAK_TIME,
  ).needle;
  return {
    id,
    action,
    polarity,
    peak,
    direction: peak > 0.001 ? 'right' : peak < -0.001 ? 'left' : 'none',
  };
}

export function needleTrace(
  action: RingAction,
  polarity: BatteryPolarity,
  width = 130,
  height = 50,
): string {
  return Array.from({ length: 61 }, (_, index) => {
    const x = (index / 60) * width;
    const y =
      height / 2 -
      inductionAt(action, polarity, (index / 60) * TRANSIENT_SECONDS).needle *
        height *
        0.37;
    return `${index ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
}

export function completedDiscovery(records: DiscoveryRecord[]): boolean {
  return (['normal', 'reversed'] as const).every((polarity) =>
    (['connect', 'hold', 'disconnect'] as const).every((action) =>
      records.some((record) => {
        const expected = observationFor(action, polarity, record.id);
        return (
          record.action === action &&
          record.polarity === polarity &&
          record.direction === expected.direction
        );
      }),
    ),
  );
}
