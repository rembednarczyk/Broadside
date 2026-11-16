/**
 * Light and colour of the scene from the time of day and the overcast (pure function, tested).
 * Sun path: a simple solar elevation curve over a 24 h day; sky colours blend between day,
 * golden hour and night keys, darkened and greyed by cloud cover (storms).
 */
export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

export interface SceneLook {
  readonly sunDir: { readonly x: number; readonly y: number; readonly z: number };
  readonly sunColor: Rgb;
  readonly sunIntensity: number;
  readonly ambient: Rgb;
  readonly skyZenith: Rgb;
  readonly skyHorizon: Rgb;
  readonly fogColor: Rgb;
  readonly fogDensity: number;
  readonly cloudCover: number;
}

const rgb = (r: number, g: number, b: number): Rgb => ({ r, g, b });
const mix = (a: Rgb, b: Rgb, t: number): Rgb => rgb(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t);
const scale = (a: Rgb, s: number): Rgb => rgb(a.r * s, a.g * s, a.b * s);
const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

const DAY_ZENITH = rgb(0.16, 0.36, 0.72);
const DAY_HORIZON = rgb(0.66, 0.78, 0.9);
const DUSK_ZENITH = rgb(0.18, 0.2, 0.42);
const DUSK_HORIZON = rgb(0.98, 0.58, 0.32);
const NIGHT_ZENITH = rgb(0.01, 0.015, 0.04);
const NIGHT_HORIZON = rgb(0.03, 0.05, 0.09);
const STORM = rgb(0.32, 0.35, 0.38);

/**
 * @param hours time of day 0..24
 * @param overcast cloud cover 0 (clear) .. 1 (storm)
 * @param fog extra fog 0..1
 */
export const sceneLook = (hours: number, overcast: number, fog: number): SceneLook => {
  const dayAngle = ((hours - 6) / 24) * Math.PI * 2;
  const elevation = Math.sin(dayAngle) * 1.15;
  const sunY = Math.max(-0.3, Math.min(1, elevation));
  const az = dayAngle * 0.9 + 0.6;
  const horiz = Math.sqrt(Math.max(0, 1 - sunY * sunY));
  const sunDir = { x: Math.cos(az) * horiz, y: sunY, z: Math.sin(az) * horiz };
  const day = clamp01((sunY + 0.05) / 0.35);
  const golden = clamp01(1 - Math.abs(sunY - 0.08) / 0.22) * clamp01(sunY + 0.1);
  let zenith = mix(NIGHT_ZENITH, mix(DAY_ZENITH, DUSK_ZENITH, golden), day);
  let horizon = mix(NIGHT_HORIZON, mix(DAY_HORIZON, DUSK_HORIZON, golden), day);
  const cover = clamp01(overcast);
  const stormTint = scale(STORM, 0.25 + 0.75 * day);
  zenith = mix(zenith, scale(stormTint, 0.8), cover * 0.85);
  horizon = mix(horizon, stormTint, cover * 0.8);
  const sunColor = mix(rgb(1, 0.97, 0.9), rgb(1, 0.6, 0.3), golden);
  const sunIntensity = day * (1 - 0.8 * cover) * 2.2;
  const ambient = scale(mix(horizon, zenith, 0.5), 0.55 + 0.3 * cover);
  const fogDensity = 0.00018 + 0.0007 * cover + 0.006 * clamp01(fog);
  return { sunDir, sunColor, sunIntensity, ambient, skyZenith: zenith, skyHorizon: horizon, fogColor: horizon, fogDensity, cloudCover: cover };
};
