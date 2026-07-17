import { describe, expect, it } from 'vitest';
import { computeLinkBudget, transferTimeS, type LinkInputs } from '../src/physics/linkBudget';
import { ARECIBO_DIAMETER_M, C0_M_S, R_SUN_M, S_PER_YEAR } from '../src/physics/constants';
import { fromDb, radToArcsec, toDb } from '../src/physics/units';

const F_HZ = 2380e6;
const LAMBDA = C0_M_S / F_HZ;
// Aperture efficiency that makes the 305 m dish exactly 74 dBi at 2380 MHz,
// matching the transmitter manual figure the notebook uses.
const ETA_74DBI = fromDb(74 - toDb((Math.PI * ARECIBO_DIAMETER_M / LAMBDA) ** 2));

/** The notebook's exact configuration: Arecibo-to-Arecibo, 10 ly, 450 kW. */
const NOTEBOOK: LinkInputs = {
  rangeLy: 10,
  frequencyHz: F_HZ,
  txPowerW: 450e3,
  txDiameterM: ARECIBO_DIAMETER_M,
  rxDiameterM: ARECIBO_DIAMETER_M,
  apertureEfficiency: ETA_74DBI,
  systemTempK: 300,
  txPointingErrArcsec: 0,
  rxPointingErrArcsec: 0,
  starTempK: 5777,
  starRadiusM: R_SUN_M,
  properMotionArcsecPerYr: 0,
};

describe('notebook validation (Arecibo ↔ Arecibo, 10 ly)', () => {
  const b = computeLinkBudget(NOTEBOOK);

  it('reproduces the notebook path loss (~379.5 dB)', () => {
    expect(b.pathLossDb).toBeCloseTo(379.5, 1);
  });

  it('reproduces 74 dBi antenna gains', () => {
    expect(b.txGainDbi).toBeCloseTo(74.0, 4);
    expect(b.rxGainDbi).toBeCloseTo(74.0, 4);
  });

  it('reproduces the notebook EIRP (130.5 dBW)', () => {
    expect(b.eirpDbw).toBeCloseTo(130.53, 1);
  });

  it('reproduces the notebook capacity of ~1.1 kbps', () => {
    expect(b.capacityBps).toBeGreaterThan(1090);
    expect(b.capacityBps).toBeLessThan(1130);
    expect(b.capacityBps).toBeCloseTo(1110, -1);
  });

  it('star noise is present but negligible (notebook conclusion)', () => {
    expect(b.starNoiseDbwHz).toBeLessThan(b.thermalNoiseDbwHz - 70);
    expect(b.totalNoiseDbwHz).toBeCloseTo(b.thermalNoiseDbwHz, 5);
  });

  it('receives a few million photons per second', () => {
    expect(b.photonRatePerS).toBeGreaterThan(1e6);
    expect(b.photonRatePerS).toBeLessThan(1e7);
  });
});

describe('scaling behaviour', () => {
  it('capacity scales with the square of tx dish diameter (power-limited link)', () => {
    const big = computeLinkBudget(NOTEBOOK);
    const small = computeLinkBudget({ ...NOTEBOOK, txDiameterM: ARECIBO_DIAMETER_M / 10 });
    // 10x smaller dish -> 20 dB less gain -> 100x less capacity ("30 m dish
    // gives ~10 bps" per the notebook's closing remark)
    expect(big.capacityBps / small.capacityBps).toBeCloseTo(100, 1);
    expect(small.capacityBps).toBeGreaterThan(9);
    expect(small.capacityBps).toBeLessThan(13);
  });

  it('capacity scales linearly with transmit power', () => {
    const half = computeLinkBudget({ ...NOTEBOOK, txPowerW: 225e3 });
    const full = computeLinkBudget(NOTEBOOK);
    expect(full.capacityBps / half.capacityBps).toBeCloseTo(2, 5);
  });
});

describe('pointing error', () => {
  it('halves the capacity at θ₃dB/2 transmit pointing error', () => {
    const clean = computeLinkBudget(NOTEBOOK);
    const err = computeLinkBudget({
      ...NOTEBOOK,
      txPointingErrArcsec: radToArcsec(clean.txHpbwRad / 2),
    });
    expect(err.txPointingLossDb).toBeCloseTo(3.01, 1);
    expect(err.capacityBps / clean.capacityBps).toBeCloseTo(0.5, 2);
    expect(err.capacityNoPointingBps).toBeCloseTo(clean.capacityBps, 4);
  });

  it('kills the link at the first null', () => {
    const clean = computeLinkBudget(NOTEBOOK);
    const err = computeLinkBudget({
      ...NOTEBOOK,
      txPointingErrArcsec: radToArcsec(clean.txFirstNullRad),
    });
    expect(err.txPointingLossDb).toBeCloseTo(60, 5);
    expect(err.capacityBps).toBeLessThan(clean.capacityBps * 2e-6);
  });

  it('rx and tx pointing losses combine', () => {
    const clean = computeLinkBudget(NOTEBOOK);
    const theta = radToArcsec(clean.txHpbwRad / 2);
    const both = computeLinkBudget({
      ...NOTEBOOK,
      txPointingErrArcsec: theta,
      rxPointingErrArcsec: theta,
    });
    expect(both.totalPointingLossDb).toBeCloseTo(6.02, 1);
    expect(both.capacityBps / clean.capacityBps).toBeCloseTo(0.25, 2);
  });

  it('beam footprint at 10 ly is a ~134 AU radius disk, and the miss distance matches the error', () => {
    const clean = computeLinkBudget(NOTEBOOK);
    expect(clean.footprintRadiusAu).toBeGreaterThan(130);
    expect(clean.footprintRadiusAu).toBeLessThan(140);
    const err = computeLinkBudget({
      ...NOTEBOOK,
      txPointingErrArcsec: radToArcsec(clean.txHpbwRad / 2),
    });
    expect(err.missDistanceAu).toBeCloseTo(err.footprintRadiusAu, 6);
  });

  it('computes the aim-ahead angle from proper motion', () => {
    const b = computeLinkBudget({
      ...NOTEBOOK,
      rangeLy: 11.9,
      properMotionArcsecPerYr: 1.92,
    });
    expect(b.aimAheadArcsec).toBeCloseTo(22.85, 1);
  });
});

describe('transfer time', () => {
  it('1 TB at the notebook capacity takes centuries', () => {
    const b = computeLinkBudget(NOTEBOOK);
    const years = transferTimeS(1e12, b.capacityBps) / S_PER_YEAR;
    expect(years).toBeGreaterThan(200);
    expect(years).toBeLessThan(240);
  });

  it('is infinite for a dead link', () => {
    expect(transferTimeS(1e12, 0)).toBe(Infinity);
  });
});
