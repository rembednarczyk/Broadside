/**
 * Light and colour of the scene from the time of day and the overcast (pure function, tested).
 * Sun path: a simple solar elevation curve over a 24 h day; sky colours blend between day,
 * golden hour and night keys, darkened and greyed by cloud cover (storms).
 *
 * Night: the moon is the key light (full moon opposite the sun; phases are not modelled because
 * the game has no calendar). Its light is drawn the way film shoots night ("day for night"): a
 * dim, cool blue key that keeps shapes legible, the blue standing for the Purkinje shift of the
 * eye in the dark. The key light (sun by day, moon by night) lights the scene and the sea's glint.
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
  /** The light that lights the scene: the sun by day, the moon by night. */
  readonly keyDir: { readonly x: number; readonly y: number; readonly z: number };
  readonly keyColor: Rgb;
  readonly keyIntensity: number;
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

/** Brightness of the horizon haze under the cloud deck: 1 under a broken sky, 0.6 under a full one (smoothstep 0.4 to 0.9 of the cover; the same curve as horizonHaze in shaders/sky.ts). */
export const hazeShade = (cover: number): number => {
  const t = clamp01((cover - 0.4) / 0.5);
  return 1 - 0.4 * t * t * (3 - 2 * t);
};

const DAY_ZENITH = rgb(0.16, 0.36, 0.72);
const DAY_HORIZON = rgb(0.66, 0.78, 0.9);
const DUSK_ZENITH = rgb(0.18, 0.2, 0.42);
const DUSK_HORIZON = rgb(0.98, 0.58, 0.32);
// Night under cloud is dark but legible (moonlight through overcast, as the reference's night shots).
const NIGHT_ZENITH = rgb(0.065, 0.08, 0.12);
const NIGHT_HORIZON = rgb(0.15, 0.17, 0.21);
const STORM = rgb(0.32, 0.35, 0.38);
const MOON = rgb(0.62, 0.74, 1);
/** Moonlight key at full height under a clear sky (a share of the noon sun's 2.2). */
const MOON_INTENSITY = 0.55;

/**
 * @param hours time of day 0..24
 * @param overcast cloud cover 0 (clear) .. 1 (storm)
 * @param fog extra fog 0..1
 * @param azimuth fixed bearing of the sun (radians, 0 = +x towards +z); omitted, it follows the hour
 */
export const sceneLook = (hours: number, overcast: number, fog: number, azimuth?: number): SceneLook => {
  const dayAngle = ((hours - 6) / 24) * Math.PI * 2;
  const elevation = Math.sin(dayAngle) * 1.15;
  const sunY = Math.max(-0.3, Math.min(1, elevation));
  const az = azimuth ?? dayAngle * 0.9 + 0.6;
  const horiz = Math.sqrt(Math.max(0, 1 - sunY * sunY));
  const sunDir = { x: Math.cos(az) * horiz, y: sunY, z: Math.sin(az) * horiz };
  const day = clamp01((sunY + 0.05) / 0.35);
  const golden = clamp01(1 - Math.abs(sunY - 0.08) / 0.22) * clamp01(sunY + 0.1);
  let zenith = mix(NIGHT_ZENITH, mix(DAY_ZENITH, DUSK_ZENITH, golden), day);
  let horizon = mix(NIGHT_HORIZON, mix(DAY_HORIZON, DUSK_HORIZON, golden), day);
  const cover = clamp01(overcast);
  // A storm by night keeps a dull grey sky (ref_075: the overcast glows faintly, the sea reads under it).
  const stormTint = scale(STORM, 0.45 + 0.55 * day);
  zenith = mix(zenith, scale(stormTint, 0.8), cover * 0.85);
  horizon = mix(horizon, stormTint, cover * 0.8);
  const sunColor = mix(rgb(1, 0.97, 0.9), rgb(1, 0.6, 0.3), golden);
  const sunIntensity = day * (1 - 0.8 * cover) * 2.2;
  const ambient = scale(mix(horizon, zenith, 0.5), (0.55 + 0.3 * cover) * (1 + 0.8 * (1 - day)));
  const moonY = Math.max(0.12, Math.min(0.95, -elevation));
  const moonH = Math.sqrt(1 - moonY * moonY);
  const moonDir = { x: -Math.cos(az) * moonH, y: moonY, z: -Math.sin(az) * moonH };
  const moonIntensity = (1 - day) * MOON_INTENSITY * clamp01(-elevation / 0.25 + 0.3) * (1 - 0.75 * cover);
  const moonKey = moonIntensity > sunIntensity;
  // Haze thickens faster than the cover: under a heavy sky the horizon and its cliffs sink into
  // it (ref_152, ref_060), under a broken one hardly changes (cover^1.5).
  const fogDensity = 0.0006 + 0.0028 * Math.pow(cover, 1.5) + 0.006 * clamp01(fog);
  // That haze lies in the shadow of the deck of cloud: a dull grey, darker than the bright band
  // of a clear horizon (the sky shader dims its own haze by the same curve, horizonHaze in shaders/sky.ts).
  const fogColor = scale(horizon, hazeShade(cover));
  return { sunDir, sunColor, sunIntensity, keyDir: moonKey ? moonDir : sunDir, keyColor: moonKey ? MOON : sunColor, keyIntensity: moonKey ? moonIntensity : sunIntensity, ambient, skyZenith: zenith, skyHorizon: horizon, fogColor, fogDensity, cloudCover: cover };
};
