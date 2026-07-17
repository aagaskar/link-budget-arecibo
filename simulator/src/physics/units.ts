import { ARCSEC_PER_RAD, S_PER_YEAR } from './constants';

/** Linear power ratio -> decibels */
export const toDb = (linear: number): number => 10 * Math.log10(linear);

/** Decibels -> linear power ratio */
export const fromDb = (db: number): number => 10 ** (db / 10);

export const radToArcsec = (rad: number): number => rad * ARCSEC_PER_RAD;
export const arcsecToRad = (arcsec: number): number => arcsec / ARCSEC_PER_RAD;

const SI_PREFIXES: Array<[number, string]> = [
  [1e12, 'T'],
  [1e9, 'G'],
  [1e6, 'M'],
  [1e3, 'k'],
  [1, ''],
  [1e-3, 'm'],
  [1e-6, 'µ'],
  [1e-9, 'n'],
  [1e-12, 'p'],
  [1e-15, 'f'],
  [1e-18, 'a'],
  [1e-21, 'z'],
  [1e-24, 'y'],
];

/** Format a value with an SI prefix, e.g. siFormat(450e3, 'W') -> "450 kW". */
export function siFormat(value: number, unit: string, digits = 3): string {
  if (!Number.isFinite(value)) return `${value} ${unit}`;
  if (value === 0) return `0 ${unit}`;
  const abs = Math.abs(value);
  for (const [scale, prefix] of SI_PREFIXES) {
    if (abs >= scale * 0.9999999) {
      return `${trimNumber(value / scale, digits)} ${prefix}${unit}`;
    }
  }
  return `${value.toExponential(digits - 1)} ${unit}`;
}

/** Round to a number of significant digits and drop trailing zeros. */
export function trimNumber(value: number, digits = 3): string {
  if (!Number.isFinite(value)) return `${value}`;
  const rounded = Number(value.toPrecision(digits));
  if (Math.abs(rounded) >= 1e6 || (rounded !== 0 && Math.abs(rounded) < 1e-4)) {
    return rounded.toExponential();
  }
  return `${rounded}`;
}

/** Format decibel quantities with a fixed decimal, e.g. "-379.5 dB". */
export function dbFormat(db: number, unit = 'dB', decimals = 1): string {
  if (!Number.isFinite(db)) return db > 0 ? `+∞ ${unit}` : `-∞ ${unit}`;
  let s = db.toFixed(decimals);
  if (Number(s) === 0) s = (0).toFixed(decimals); // avoid "-0.0"
  return `${s} ${unit}`;
}

/** Format an angle given in radians, adaptively (mas / arcsec / arcmin / deg). */
export function angleFormat(rad: number, digits = 3): string {
  const arcsec = radToArcsec(Math.abs(rad));
  const sign = rad < 0 ? '-' : '';
  if (arcsec === 0) return '0″';
  if (arcsec < 0.001) return `${sign}${trimNumber(arcsec * 1e6, digits)} µas`;
  if (arcsec < 1) return `${sign}${trimNumber(arcsec * 1e3, digits)} mas`;
  if (arcsec < 120) return `${sign}${trimNumber(arcsec, digits)}″`;
  if (arcsec < 7200) return `${sign}${trimNumber(arcsec / 60, digits)}′`;
  return `${sign}${trimNumber(arcsec / 3600, digits)}°`;
}

/** Format a duration in seconds using human units (up to years). */
export function durationFormat(seconds: number, digits = 3): string {
  if (!Number.isFinite(seconds)) return '∞';
  if (seconds < 1e-3) return `${trimNumber(seconds * 1e6, digits)} µs`;
  if (seconds < 1) return `${trimNumber(seconds * 1e3, digits)} ms`;
  if (seconds < 120) return `${trimNumber(seconds, digits)} s`;
  if (seconds < 7200) return `${trimNumber(seconds / 60, digits)} min`;
  if (seconds < 172800) return `${trimNumber(seconds / 3600, digits)} hours`;
  if (seconds < 2 * S_PER_YEAR) return `${trimNumber(seconds / 86400, digits)} days`;
  if (seconds < 1e3 * S_PER_YEAR) return `${trimNumber(seconds / S_PER_YEAR, digits)} years`;
  if (seconds < 1e6 * S_PER_YEAR) return `${trimNumber(seconds / (1e3 * S_PER_YEAR), digits)} kyr`;
  if (seconds < 1e9 * S_PER_YEAR) return `${trimNumber(seconds / (1e6 * S_PER_YEAR), digits)} Myr`;
  return `${trimNumber(seconds / (1e9 * S_PER_YEAR), digits)} Gyr`;
}

/** Format a data rate in bits per second. */
export function rateFormat(bps: number, digits = 3): string {
  if (!Number.isFinite(bps) || bps <= 0) return '0 bps';
  if (bps < 1) return `${trimNumber(bps, digits)} bps`;
  return siFormat(bps, 'bps', digits);
}
