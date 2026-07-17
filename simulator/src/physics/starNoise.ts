/**
 * Broadband radio noise from the transmitter's host star, as seen by the
 * receiving dish. The receive beam cannot resolve the transmitter from its
 * star, so the star's blackbody emission lands in the receiver along with the
 * signal. The notebook shows this is utterly negligible next to receiver
 * thermal noise; it is kept here so the simulator can demonstrate that.
 */

import { C0_M_S, H_J_HZ, K_B_J_K } from './constants';

/** Planck spectral radiance B(f, T), W · m⁻² · Hz⁻¹ · sr⁻¹. */
export function planckRadiance(fHz: number, tK: number): number {
  const x = (H_J_HZ * fHz) / (K_B_J_K * tK);
  return ((2 * H_J_HZ * fHz ** 3) / C0_M_S ** 2) / Math.expm1(x);
}

/**
 * Total spectral luminosity of a blackbody sphere, W/Hz:
 * L_ν = (surface area 4πr²) · (hemispheric exitance π·B).
 * Integrating over frequency recovers the Stefan–Boltzmann total σT⁴·4πr².
 */
export function starSpectralLuminosityWHz(fHz: number, tK: number, radiusM: number): number {
  return 4 * Math.PI * Math.PI * radiusM * radiusM * planckRadiance(fHz, tK);
}

/**
 * Star noise power spectral density delivered by the receive antenna, W/Hz:
 * flux density L_ν/(4πR²) times effective aperture A_eff = G·λ²/(4π).
 * (Polarization is ignored — a single-pol receiver would collect half.)
 */
export function starNoisePsdWHz(
  fHz: number,
  tK: number,
  radiusM: number,
  rangeM: number,
  rxGainLinear: number,
  lambdaM: number,
): number {
  const fluxWM2Hz = starSpectralLuminosityWHz(fHz, tK, radiusM) / (4 * Math.PI * rangeM * rangeM);
  const aEffM2 = (rxGainLinear * lambdaM * lambdaM) / (4 * Math.PI);
  return fluxWM2Hz * aEffM2;
}
