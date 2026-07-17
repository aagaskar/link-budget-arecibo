import { ARECIBO_DIAMETER_M, C0_M_S } from './physics/constants';
import type { LinkInputs } from './physics/linkBudget';
import { DEFAULT_PRESET, STAR_PRESETS, type StarPreset } from './physics/presets';
import { fromDb, toDb } from './physics/units';

/**
 * Aperture efficiency that makes a 305 m dish exactly 74 dBi at 2380 MHz —
 * the figure in the Arecibo transmitter manual and the notebook. ~0.434.
 */
export const NOTEBOOK_EFFICIENCY = fromDb(
  74 - toDb((Math.PI * ARECIBO_DIAMETER_M / (C0_M_S / 2380e6)) ** 2),
);

/** The notebook / Arecibo-message transmitter configuration. */
export const NOTEBOOK_CONFIG = {
  frequencyHz: 2380e6,
  txPowerW: 450e3,
  txDiameterM: ARECIBO_DIAMETER_M,
  rxDiameterM: ARECIBO_DIAMETER_M,
  apertureEfficiency: NOTEBOOK_EFFICIENCY,
  systemTempK: 300,
  txPointingErrArcsec: 0,
  rxPointingErrArcsec: 0,
} as const;

export interface AppState extends LinkInputs {
  presetId: string;
}

export function initialState(): AppState {
  return {
    presetId: DEFAULT_PRESET.id,
    rangeLy: DEFAULT_PRESET.distanceLy,
    starTempK: DEFAULT_PRESET.starTempK,
    starRadiusM: DEFAULT_PRESET.starRadiusM,
    properMotionArcsecPerYr: DEFAULT_PRESET.properMotionArcsecPerYr,
    ...NOTEBOOK_CONFIG,
  };
}

export function applyPreset(state: AppState, preset: StarPreset): void {
  state.presetId = preset.id;
  state.rangeLy = preset.distanceLy;
  state.starTempK = preset.starTempK;
  state.starRadiusM = preset.starRadiusM;
  state.properMotionArcsecPerYr = preset.properMotionArcsecPerYr;
}

export function presetById(id: string): StarPreset | undefined {
  return STAR_PRESETS.find((p) => p.id === id);
}

/** Detach the preset chip when the user hand-tunes the distance. */
export function markCustomDistance(state: AppState): void {
  const preset = presetById(state.presetId);
  if (preset && Math.abs(preset.distanceLy - state.rangeLy) > 1e-9) {
    state.presetId = 'custom';
  }
}
