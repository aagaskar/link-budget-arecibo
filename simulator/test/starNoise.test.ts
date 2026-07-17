import { describe, expect, it } from 'vitest';
import {
  planckRadiance,
  starNoisePsdWHz,
  starSpectralLuminosityWHz,
} from '../src/physics/starNoise';
import { C0_M_S, M_PER_LY, R_SUN_M } from '../src/physics/constants';
import { fromDb, toDb } from '../src/physics/units';

const T_SUN = 5777; // notebook value
const F_HZ = 2380e6;

describe('Planck radiance', () => {
  it('matches Rayleigh–Jeans at radio frequencies', () => {
    const rj = (2 * F_HZ ** 2 * 1.380649e-23 * T_SUN) / C0_M_S ** 2;
    expect(planckRadiance(F_HZ, T_SUN)).toBeCloseTo(rj, 20);
    expect(planckRadiance(F_HZ, T_SUN) / rj).toBeGreaterThan(0.99);
  });
});

describe('star spectral luminosity', () => {
  it('integrates to the Stefan–Boltzmann total within ~2% (notebook sanity check)', () => {
    // Trapezoid on a log-spaced grid, 1 MHz .. c/10nm (same span as notebook)
    const n = 4000;
    const f0 = 1e6;
    const f1 = C0_M_S / 10e-9;
    let integral = 0;
    let prevF = f0;
    let prevY = starSpectralLuminosityWHz(f0, T_SUN, R_SUN_M);
    for (let k = 1; k <= n; k++) {
      const f = f0 * (f1 / f0) ** (k / n);
      const y = starSpectralLuminosityWHz(f, T_SUN, R_SUN_M);
      integral += 0.5 * (y + prevY) * (f - prevF);
      prevF = f;
      prevY = y;
    }
    const stefanBoltzmann = 5.670374419e-8 * T_SUN ** 4 * 4 * Math.PI * R_SUN_M ** 2;
    expect(Math.abs(integral - stefanBoltzmann) / stefanBoltzmann).toBeLessThan(0.02);
  });

  it('is ~23 dBW/Hz at 2380 MHz for the Sun (notebook figure)', () => {
    expect(toDb(starSpectralLuminosityWHz(F_HZ, T_SUN, R_SUN_M))).toBeCloseTo(22.9, 0);
  });
});

describe('star noise at the receiver', () => {
  it('is negligible next to 300 K thermal noise for the notebook link', () => {
    const rangeM = 10 * M_PER_LY;
    const lambda = C0_M_S / F_HZ;
    const psd = starNoisePsdWHz(F_HZ, T_SUN, R_SUN_M, rangeM, fromDb(74), lambda);
    const thermal = 1.380649e-23 * 300;
    // Notebook: star PSD ≈ -356.6 dBW/Hz before receive gain; with the 74 dBi
    // dish it is still ~76 dB below thermal noise.
    expect(toDb(psd)).toBeCloseTo(-356.6 + 74, 0);
    expect(toDb(thermal) - toDb(psd)).toBeGreaterThan(70);
  });
});
