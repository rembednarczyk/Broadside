import { type Archipelago, type GerstnerWave, type Rng, type SeaState, type WaveBand, type WeatherKind, type WeatherState, approach, createWeather, seaWaves, subRng, waveBands, windVector, type Wind2D, type StormCell, CELLS, SECONDS_PER_HOUR, cellInfluence, driftCells } from "@broadside/core";

/**
 * Wind and sea shared by every ship. The sea follows the wind with a lag (a sea builds up and
 * dies down over minutes), so a sudden squall first heels the ship and only later raises waves.
 */
export interface Environment {
  readonly seed: number;
  time: number;
  readonly bands: readonly WaveBand[];
  windDirection: number;
  windSpeed: number;
  /** Wind speed the sea is currently developed for. */
  seaWind: number;
  swell: number;
  waves: GerstnerWave[];
  /** Dynamic weather, or null for a fixed wind (tests, set pieces). */
  weather: WeatherState | null;
  weatherRng: Rng;
  /** Seconds left of a rogue wave group (raised swell). */
  rogue: number;
  /** Islands and seabed, or null for open sea. */
  readonly archipelago: Archipelago | null;
  /** Storm cells drifting over the sea (local squalls). */
  cells: StormCell[];
  /** Hour of day at time 0, and whether the clock runs (held, a fixed light for set pieces). */
  readonly startHours: number;
  readonly clockRuns: boolean;
}

/** Hour of day now (0..24). */
export const hoursNow = (env: Environment): number => (env.clockRuns ? (env.startHours + env.time / SECONDS_PER_HOUR) % 24 : env.startHours);

/** m/s of sea development per second towards the wind. */
const SEA_BUILD_RATE = 0.02;

export const createEnvironment = (seed: number, windDirection: number, windSpeed: number, weather?: WeatherKind, archipelago: Archipelago | null = null, hours?: number, clockRuns = true): Environment => {
  const bands = waveBands(seed, windDirection);
  const weatherRng = subRng(seed, "weather");
  const w = weather ? createWeather(weather, windDirection, seed, weatherRng) : null;
  const wind = w ? w.meanWind : windSpeed;
  const sea: SeaState = { windSpeed: wind, swell: 0 };
  return { seed, time: 0, bands, windDirection, windSpeed: wind, seaWind: wind, swell: 0, waves: seaWaves(bands, sea), weather: w, weatherRng, rogue: 0, archipelago, cells: [], startHours: hours ?? 12, clockRuns: hours !== undefined && clockRuns };
};

/** Extra swell height of a rogue wave group, rising and falling over its 30 seconds. */
const ROGUE_SECONDS = 30;
const ROGUE_HEIGHT = 4.5;

export const stepEnvironment = (env: Environment, dt: number): void => {
  env.time += dt;
  if (env.rogue > 0) env.rogue = Math.max(0, env.rogue - dt);
  const swell = env.rogue > 0 ? Math.sin((1 - env.rogue / ROGUE_SECONDS) * Math.PI) * ROGUE_HEIGHT : 0;
  const swellChanged = Math.abs(swell - env.swell) > 1e-6;
  env.swell = swell;
  const before = env.seaWind;
  env.seaWind = approach(env.seaWind, env.windSpeed, SEA_BUILD_RATE * dt * Math.max(1, Math.abs(env.windSpeed - env.seaWind)));
  if (env.cells.length) env.cells = driftCells(env.cells, env.windDirection, env.windSpeed, dt);
  if (before !== env.seaWind || swellChanged || env.time <= dt) env.waves = seaWaves(env.bands, { windSpeed: env.seaWind, swell: env.swell });
};

/**
 * True wind at a height above the sea (power-law profile, exponent 0.11 over open water), stronger
 * under a storm cell when a position is given.
 */
export const windAt = (env: Environment, height: number, x?: number, z?: number): Wind2D => {
  const cell = x === undefined || z === undefined ? 0 : cellInfluence(env.cells, x, z);
  return windVector(env.windDirection, env.windSpeed * (1 + CELLS.gust * cell) * Math.pow(Math.max(1, height) / 10, 0.11));
};

/** Rain over a point: the sea's weather or a storm cell, whichever is heavier. */
export const rainAt = (env: Environment, x: number, z: number): number => Math.max(env.weather?.rain ?? 0, cellInfluence(env.cells, x, z));

export const startRogue = (env: Environment): void => {
  if (env.rogue <= 0) env.rogue = ROGUE_SECONDS;
};
