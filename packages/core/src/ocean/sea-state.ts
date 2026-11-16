import { subRng, range } from "../math/rng";
import { type GerstnerWave, GRAVITY, MAX_WAVES, makeWave } from "./gerstner";

/**
 * Sea from wind (Pierson-Moskowitz spectrum, 1964):
 *   S(w) = alpha g^2 / w^5 * exp(-beta (g / (U w))^4),  alpha = 8.1e-3, beta = 0.74.
 * The sea is MAX_WAVES fixed bands (wavelength, direction, phase drawn once from the seed); only
 * the amplitudes follow the wind, a_i = sqrt(2 S(w_i) dw_i). Changing the wind therefore changes
 * the sea smoothly, without phase jumps (a band's position never moves).
 * Directions are "towards": an angle like a ship's heading (0 = +Z, PI/2 = +X).
 */
export interface WaveBand {
  readonly wavelength: number;
  readonly omega: number;
  readonly dOmega: number;
  readonly dirAngle: number;
  readonly phase: number;
}

export interface SeaState {
  /** Wind speed in m/s, 19.5 m above the sea as in the spectrum. */
  readonly windSpeed: number;
  /** Extra long swell from storms elsewhere, metres of height. */
  readonly swell: number;
}

const ALPHA = 8.1e-3;
const BETA = 0.74;
const MIN_WAVELENGTH = 4;
const MAX_WAVELENGTH = 240;
/** Game scale on the spectrum: the full gale sea is taller than fun allows. */
export const HEIGHT_SCALE = 0.85;
/** A light ripple remains even in a calm. */
const RIPPLE = 0.05;

export const significantHeight = (windSpeed: number): number => (0.21 * windSpeed * windSpeed) / GRAVITY;

export const spectrum = (omega: number, windSpeed: number): number => {
  if (windSpeed < 0.1) return 0;
  return ((ALPHA * GRAVITY * GRAVITY) / omega ** 5) * Math.exp(-BETA * (GRAVITY / (windSpeed * omega)) ** 4);
};

const omegaOf = (wavelength: number): number => Math.sqrt((GRAVITY * 2 * Math.PI) / wavelength);

/** Fixed bands of a sea area: log-spaced wavelengths, directions spread around the prevailing wind. */
export const waveBands = (seed: number, prevailing: number): WaveBand[] => {
  const rng = subRng(seed, "wave-bands");
  const bands: WaveBand[] = [];
  for (let i = 0; i < MAX_WAVES; i++) {
    const f = i / (MAX_WAVES - 1);
    const wavelength = MAX_WAVELENGTH * (MIN_WAVELENGTH / MAX_WAVELENGTH) ** f * range(rng, 0.92, 1.08);
    const lo = omegaOf(MAX_WAVELENGTH * (MIN_WAVELENGTH / MAX_WAVELENGTH) ** Math.max(0, f - 0.5 / (MAX_WAVES - 1)));
    const hi = omegaOf(MAX_WAVELENGTH * (MIN_WAVELENGTH / MAX_WAVELENGTH) ** Math.min(1, f + 0.5 / (MAX_WAVES - 1)));
    bands.push({
      wavelength,
      omega: omegaOf(wavelength),
      dOmega: hi - lo,
      // Short waves spread wider around the wind than long ones (cos^2s spreading, coarse).
      dirAngle: prevailing + range(rng, -1, 1) * (0.15 + 0.6 * f),
      phase: range(rng, 0, Math.PI * 2),
    });
  }
  return bands;
};

export const bandAmplitude = (band: WaveBand, sea: SeaState): number =>
  Math.sqrt(2 * spectrum(band.omega, sea.windSpeed) * band.dOmega) * HEIGHT_SCALE + RIPPLE * (band.wavelength < 20 ? 1 : 0.2);

/** Gerstner waves of the bands for the current sea; the longest band also carries the swell. */
export const seaWaves = (bands: readonly WaveBand[], sea: SeaState): GerstnerWave[] => {
  const steep = Math.min(0.8, 0.3 + sea.windSpeed / 45);
  return bands.map((b, i) => {
    const amp = bandAmplitude(b, sea) + (i === 0 ? sea.swell / 2 : 0);
    return makeWave(b.dirAngle, b.wavelength, Math.max(0.005, amp), steep, b.phase, bands.length);
  });
};
