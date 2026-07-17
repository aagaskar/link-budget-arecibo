/**
 * End-to-end interstellar link budget, following the notebook in
 * ../notebook/arecibo_message_link_budget.ipynb:
 *
 *   C/N₀ = EIRP − L_path + G_rx − N₀            (all in dB)
 *   C    = (C/N₀ linear) / ln 2                 (Shannon capacity, B → ∞)
 *
 * extended with pointing loss on both ends (Airy pattern) and star noise
 * folded into N₀.
 */

import { C0_M_S, H_J_HZ, K_B_J_K, M_PER_AU, M_PER_LY } from './constants';
import {
  airyRelativeGain,
  dishGainDbi,
  firstNullRad,
  hpbwRad,
  pointingLossDb,
} from './antenna';
import { starNoisePsdWHz } from './starNoise';
import { arcsecToRad, fromDb, toDb } from './units';

export interface LinkInputs {
  /** Distance from the transmitter's star to the Sun, light years. */
  rangeLy: number;
  /** Carrier frequency, Hz. */
  frequencyHz: number;
  /** Transmitter RF power, W. */
  txPowerW: number;
  /** Remote transmit dish diameter, m. */
  txDiameterM: number;
  /** Receive dish diameter, m (Arecibo: 305). */
  rxDiameterM: number;
  /** Aperture efficiency applied to both dishes (0..1). */
  apertureEfficiency: number;
  /** Receive system noise temperature, K. */
  systemTempK: number;
  /** Transmit antenna pointing error, arcsec. */
  txPointingErrArcsec: number;
  /** Receive antenna pointing error, arcsec. */
  rxPointingErrArcsec: number;
  /** Host star blackbody temperature, K. */
  starTempK: number;
  /** Host star radius, m. */
  starRadiusM: number;
  /** Host star total proper motion, arcsec/yr (for the aim-ahead angle). */
  properMotionArcsecPerYr: number;
}

export interface LinkBudget {
  // Geometry
  rangeM: number;
  lambdaM: number;
  lightTravelYears: number;

  // Transmit side
  txPowerDbw: number;
  txGainDbi: number;
  txHpbwRad: number;
  txFirstNullRad: number;
  txPointingLossDb: number;
  eirpDbw: number;

  // Path
  pathLossDb: number;
  /** Radius of the half-power beam footprint at Earth, AU. */
  footprintRadiusAu: number;
  /** Radius of the first-null cone at Earth, AU. */
  firstNullRadiusAu: number;
  /** How far the beam axis misses the Sun, AU, given the tx pointing error. */
  missDistanceAu: number;
  /** Lateral beam displacement at Earth per arcsecond of tx pointing error, AU. */
  beamWalkAuPerArcsec: number;
  /** Aim-ahead angle demanded by the star's proper motion, arcsec. */
  aimAheadArcsec: number;

  // Receive side
  rxGainDbi: number;
  rxHpbwRad: number;
  rxPointingLossDb: number;
  rxPowerDbw: number;
  rxPowerW: number;
  /** Received signal photon rate, photons/s — the link counts photons. */
  photonRatePerS: number;

  // Noise
  thermalNoiseDbwHz: number;
  starNoiseDbwHz: number;
  totalNoiseDbwHz: number;

  // Performance
  cn0DbHz: number;
  /** Shannon capacity in the power-limited (infinite bandwidth) limit, bit/s. */
  capacityBps: number;
  /** Capacity with zero pointing error on both ends, bit/s. */
  capacityNoPointingBps: number;
  /** Total pointing loss (tx + rx), dB. */
  totalPointingLossDb: number;
}

export function computeLinkBudget(i: LinkInputs): LinkBudget {
  const rangeM = i.rangeLy * M_PER_LY;
  const lambdaM = C0_M_S / i.frequencyHz;

  // --- Transmit side ---
  const txPowerDbw = toDb(i.txPowerW);
  const txGainDbi = dishGainDbi(i.txDiameterM, lambdaM, i.apertureEfficiency);
  const txErrRad = arcsecToRad(i.txPointingErrArcsec);
  const txPointingLossDb = pointingLossDb(txErrRad, i.txDiameterM, lambdaM);
  const eirpDbw = txPowerDbw + txGainDbi - txPointingLossDb;

  // --- Path ---
  const pathLossDb = toDb(((4 * Math.PI * rangeM) / lambdaM) ** 2);
  const txHpbw = hpbwRad(i.txDiameterM, lambdaM);
  const txNull = firstNullRad(i.txDiameterM, lambdaM);

  // --- Receive side ---
  const rxGainDbi = dishGainDbi(i.rxDiameterM, lambdaM, i.apertureEfficiency);
  const rxErrRad = arcsecToRad(i.rxPointingErrArcsec);
  const rxPointingLossDb = pointingLossDb(rxErrRad, i.rxDiameterM, lambdaM);
  const rxPowerDbw = eirpDbw - pathLossDb + rxGainDbi - rxPointingLossDb;
  const rxPowerW = fromDb(rxPowerDbw);

  // --- Noise ---
  const thermalNoiseWHz = K_B_J_K * i.systemTempK;
  // Star noise reaches the receiver through the (mispointed) main beam, so it
  // sees the same off-axis relative gain the signal does.
  const rxGainTowardStar =
    fromDb(rxGainDbi) * airyRelativeGain(rxErrRad, i.rxDiameterM, lambdaM);
  const starNoiseWHz = starNoisePsdWHz(
    i.frequencyHz,
    i.starTempK,
    i.starRadiusM,
    rangeM,
    rxGainTowardStar,
    lambdaM,
  );
  const totalNoiseWHz = thermalNoiseWHz + starNoiseWHz;

  // --- Performance ---
  const cn0DbHz = rxPowerDbw - toDb(totalNoiseWHz);
  const capacityBps = fromDb(cn0DbHz) / Math.LN2;
  const capacityNoPointingBps =
    fromDb(cn0DbHz + txPointingLossDb + rxPointingLossDb) / Math.LN2;

  return {
    rangeM,
    lambdaM,
    lightTravelYears: i.rangeLy,

    txPowerDbw,
    txGainDbi,
    txHpbwRad: txHpbw,
    txFirstNullRad: txNull,
    txPointingLossDb,
    eirpDbw,

    pathLossDb,
    footprintRadiusAu: (Math.tan(txHpbw / 2) * rangeM) / M_PER_AU,
    firstNullRadiusAu: (Math.tan(txNull) * rangeM) / M_PER_AU,
    missDistanceAu: (Math.tan(arcsecToRad(i.txPointingErrArcsec)) * rangeM) / M_PER_AU,
    beamWalkAuPerArcsec: (Math.tan(arcsecToRad(1)) * rangeM) / M_PER_AU,
    aimAheadArcsec: i.properMotionArcsecPerYr * i.rangeLy,

    rxGainDbi,
    rxHpbwRad: hpbwRad(i.rxDiameterM, lambdaM),
    rxPointingLossDb,
    rxPowerDbw,
    rxPowerW,
    photonRatePerS: rxPowerW / (H_J_HZ * i.frequencyHz),

    thermalNoiseDbwHz: toDb(thermalNoiseWHz),
    starNoiseDbwHz: toDb(starNoiseWHz),
    totalNoiseDbwHz: toDb(totalNoiseWHz),

    cn0DbHz,
    capacityBps,
    capacityNoPointingBps,
    totalPointingLossDb: txPointingLossDb + rxPointingLossDb,
  };
}

/** Seconds required to move `bytes` at Shannon capacity. */
export function transferTimeS(bytes: number, capacityBps: number): number {
  if (capacityBps <= 0) return Infinity;
  return (bytes * 8) / capacityBps;
}
