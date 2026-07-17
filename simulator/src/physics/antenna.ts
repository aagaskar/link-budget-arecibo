/**
 * Parabolic-dish antenna model: on-axis gain, and off-axis gain roll-off used
 * to quantify pointing error.
 *
 * The off-axis pattern is the classical Airy pattern of a uniformly
 * illuminated circular aperture, G(θ)/G(0) = [2·J1(x)/x]² with
 * x = (πD/λ)·sin θ. Real feeds taper the illumination, which widens the main
 * lobe slightly and lowers the sidelobes, so treat the numbers as accurate for
 * the main lobe and optimistic for the sidelobes. The common small-offset
 * approximation L ≈ 12·(θ/θ₃dB)² dB is also provided for comparison.
 */

import { toDb } from './units';

/**
 * Bessel function of the first kind, order 1.
 * Abramowitz & Stegun 9.4.4 / 9.4.6 polynomial approximations (|ε| < 1.3e-8
 * for |x|≤3 and < 1e-7 beyond) — plenty for dB-level pattern work.
 */
export function besselJ1(x: number): number {
  const ax = Math.abs(x);
  if (ax < 3) {
    const t = (x / 3) ** 2;
    return (
      x *
      (0.5 -
        t *
          (0.56249985 -
            t *
              (0.21093573 -
                t * (0.03954289 - t * (0.00443319 - t * (0.00031761 - t * 0.00001109))))))
    );
  }
  const t = 3 / ax;
  const f1 =
    0.79788456 +
    t *
      (0.00000156 +
        t * (0.01659667 + t * (0.00017105 - t * (0.00249511 - t * (0.00113653 - t * 0.00020033)))));
  const theta1 =
    ax -
    2.35619449 +
    t *
      (0.12499612 +
        t * (0.0000565 - t * (0.00637879 - t * (0.00074348 + t * (0.00079824 - t * 0.00029166)))));
  const r = (f1 * Math.cos(theta1)) / Math.sqrt(ax);
  return x < 0 ? -r : r;
}

/** Half-power full beamwidth of the Airy pattern: θ₃dB ≈ 1.02899·λ/D rad. */
export const HPBW_FACTOR = 1.02899;

/** First-null half-angle of the Airy pattern: θ_null ≈ 1.21967·λ/D rad. */
export const FIRST_NULL_FACTOR = 1.21967;

/**
 * Relative gain floor. Real antennas scatter enough power that far sidelobes
 * sit tens of dB below the peak rather than at the Airy pattern's perfect
 * nulls; clamping also keeps the dB math finite.
 */
export const PATTERN_FLOOR = 1e-6; // -60 dB relative to boresight

/** On-axis gain of a circular aperture: η·(πD/λ)², in dBi. */
export function dishGainDbi(diameterM: number, lambdaM: number, efficiency: number): number {
  return toDb(efficiency * (Math.PI * diameterM / lambdaM) ** 2);
}

/** Half-power full beamwidth in radians. */
export function hpbwRad(diameterM: number, lambdaM: number): number {
  return (HPBW_FACTOR * lambdaM) / diameterM;
}

/** Angle from boresight to the first pattern null, radians. */
export function firstNullRad(diameterM: number, lambdaM: number): number {
  return (FIRST_NULL_FACTOR * lambdaM) / diameterM;
}

/** Relative (linear, ≤ 1) gain of the Airy pattern at off-axis angle θ. */
export function airyRelativeGain(thetaRad: number, diameterM: number, lambdaM: number): number {
  const theta = Math.min(Math.abs(thetaRad), Math.PI / 2);
  const x = ((Math.PI * diameterM) / lambdaM) * Math.sin(theta);
  if (x < 1e-8) return 1;
  const v = (2 * besselJ1(x)) / x;
  return Math.max(v * v, PATTERN_FLOOR);
}

/** Pointing loss in dB (≥ 0) at off-axis angle θ, from the Airy pattern. */
export function pointingLossDb(thetaRad: number, diameterM: number, lambdaM: number): number {
  return Math.max(0, -toDb(airyRelativeGain(thetaRad, diameterM, lambdaM)));
}

/**
 * Textbook small-offset approximation: L ≈ 12·(θ/θ₃dB)² dB.
 * Good to ~θ₃dB/2; increasingly wrong near the first null.
 */
export function gaussianPointingLossDb(
  thetaRad: number,
  diameterM: number,
  lambdaM: number,
): number {
  const ratio = Math.abs(thetaRad) / hpbwRad(diameterM, lambdaM);
  return 12 * ratio * ratio;
}
