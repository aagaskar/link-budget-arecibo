import { describe, expect, it } from 'vitest';
import {
  PATTERN_FLOOR,
  airyRelativeGain,
  besselJ1,
  dishGainDbi,
  firstNullRad,
  gaussianPointingLossDb,
  hpbwRad,
  pointingLossDb,
} from '../src/physics/antenna';
import { C0_M_S, ARECIBO_DIAMETER_M } from '../src/physics/constants';
import { fromDb, radToArcsec, toDb } from '../src/physics/units';

const F_HZ = 2380e6;
const LAMBDA = C0_M_S / F_HZ;

describe('besselJ1', () => {
  it('matches tabulated values', () => {
    expect(besselJ1(0)).toBe(0);
    expect(besselJ1(1)).toBeCloseTo(0.4400505857, 6);
    expect(besselJ1(2)).toBeCloseTo(0.5767248078, 6);
    expect(besselJ1(5)).toBeCloseTo(-0.3275791376, 6);
    expect(besselJ1(-1)).toBeCloseTo(-0.4400505857, 6);
  });

  it('has its first zero at x = 3.8317', () => {
    expect(Math.abs(besselJ1(3.831706))).toBeLessThan(1e-5);
  });
});

describe('dish gain', () => {
  it('reproduces the 74 dBi Arecibo S-band transmit gain from the manual', () => {
    // Efficiency chosen so the 305 m aperture gives exactly the documented
    // 74 dBi at 2380 MHz; comes out to a plausible ~0.43.
    const eta = fromDb(74 - toDb((Math.PI * ARECIBO_DIAMETER_M / LAMBDA) ** 2));
    expect(eta).toBeGreaterThan(0.4);
    expect(eta).toBeLessThan(0.5);
    expect(dishGainDbi(ARECIBO_DIAMETER_M, LAMBDA, eta)).toBeCloseTo(74.0, 6);
  });

  it('gains 6 dB per doubling of diameter', () => {
    const g1 = dishGainDbi(100, LAMBDA, 0.5);
    const g2 = dishGainDbi(200, LAMBDA, 0.5);
    expect(g2 - g1).toBeCloseTo(6.0206, 3);
  });
});

describe('beam geometry', () => {
  it('Arecibo at 2380 MHz has an ~88 arcsec half-power beamwidth', () => {
    const hpbw = hpbwRad(ARECIBO_DIAMETER_M, LAMBDA);
    expect(radToArcsec(hpbw)).toBeGreaterThan(85);
    expect(radToArcsec(hpbw)).toBeLessThan(91);
  });

  it('first null sits beyond the half-power point', () => {
    expect(firstNullRad(ARECIBO_DIAMETER_M, LAMBDA)).toBeGreaterThan(
      hpbwRad(ARECIBO_DIAMETER_M, LAMBDA) / 2,
    );
  });
});

describe('Airy pattern pointing loss', () => {
  it('is 0 dB on boresight', () => {
    expect(pointingLossDb(0, ARECIBO_DIAMETER_M, LAMBDA)).toBe(0);
  });

  it('is 3 dB at half the half-power beamwidth off axis', () => {
    const theta = hpbwRad(ARECIBO_DIAMETER_M, LAMBDA) / 2;
    expect(airyRelativeGain(theta, ARECIBO_DIAMETER_M, LAMBDA)).toBeCloseTo(0.5, 2);
    expect(pointingLossDb(theta, ARECIBO_DIAMETER_M, LAMBDA)).toBeCloseTo(3.01, 1);
  });

  it('bottoms out at the pattern floor at the first null', () => {
    const theta = firstNullRad(ARECIBO_DIAMETER_M, LAMBDA);
    expect(airyRelativeGain(theta, ARECIBO_DIAMETER_M, LAMBDA)).toBe(PATTERN_FLOOR);
  });

  it('first sidelobe is ~17.6 dB down', () => {
    // Airy first sidelobe peak at x = 5.1356, i.e. θ = 5.1356·λ/(πD)
    const theta = (5.1356 * LAMBDA) / (Math.PI * ARECIBO_DIAMETER_M);
    expect(pointingLossDb(theta, ARECIBO_DIAMETER_M, LAMBDA)).toBeCloseTo(17.57, 0);
  });

  it('agrees with the 12(θ/θ₃dB)² approximation for small offsets', () => {
    const theta = 0.2 * hpbwRad(ARECIBO_DIAMETER_M, LAMBDA);
    const airy = pointingLossDb(theta, ARECIBO_DIAMETER_M, LAMBDA);
    const gauss = gaussianPointingLossDb(theta, ARECIBO_DIAMETER_M, LAMBDA);
    expect(Math.abs(airy - gauss)).toBeLessThan(0.06);
  });
});
