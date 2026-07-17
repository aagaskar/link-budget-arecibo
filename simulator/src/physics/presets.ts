import { R_SUN_M } from './constants';

/** A transmitter location: a nearby star hosting the remote antenna. */
export interface StarPreset {
  id: string;
  name: string;
  blurb: string;
  distanceLy: number;
  /** Effective (blackbody) temperature of the star, K. */
  starTempK: number;
  /** Stellar radius, m. */
  starRadiusM: number;
  /**
   * Total proper motion, arcsec/yr. Sets the "aim-ahead" angle: the
   * transmitter must aim where the Sun will appear one light-travel-time
   * later, offset ≈ μ · (R/c).
   */
  properMotionArcsecPerYr: number;
}

/** Stellar parameters are approximate catalog values. */
export const STAR_PRESETS: StarPreset[] = [
  {
    id: 'tau-ceti',
    name: 'Tau Ceti',
    blurb: 'Destination of the Hail Mary — the Astrophage breeding ground',
    distanceLy: 11.9,
    starTempK: 5344,
    starRadiusM: 0.793 * (6.957e8),
    properMotionArcsecPerYr: 1.92,
  },
  {
    id: '40-eridani',
    name: '40 Eridani A',
    blurb: "Erid — Rocky's home system",
    distanceLy: 16.3,
    starTempK: 5300,
    starRadiusM: 0.81 * (6.957e8),
    properMotionArcsecPerYr: 4.09,
  },
  {
    id: 'proxima',
    name: 'Proxima Centauri',
    blurb: 'Nearest star to the Sun (red dwarf)',
    distanceLy: 4.246,
    starTempK: 3042,
    starRadiusM: 0.154 * (6.957e8),
    properMotionArcsecPerYr: 3.85,
  },
  {
    id: 'notebook',
    name: 'Notebook baseline',
    blurb: 'Idealized Sun twin at 10 ly — reproduces the Python notebook',
    distanceLy: 10,
    starTempK: 5777,
    starRadiusM: R_SUN_M,
    properMotionArcsecPerYr: 0,
  },
];

export const DEFAULT_PRESET = STAR_PRESETS[0]!;
