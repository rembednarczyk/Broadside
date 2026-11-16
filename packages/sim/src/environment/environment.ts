import { type GerstnerWave, type SeaState, type WaveBand, approach, seaWaves, waveBands, windVector, type Wind2D } from "@broadside/core";

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
}

/** m/s of sea development per second towards the wind. */
const SEA_BUILD_RATE = 0.02;

export const createEnvironment = (seed: number, windDirection: number, windSpeed: number): Environment => {
  const bands = waveBands(seed, windDirection);
  const sea: SeaState = { windSpeed, swell: 0 };
  return { seed, time: 0, bands, windDirection, windSpeed, seaWind: windSpeed, swell: 0, waves: seaWaves(bands, sea) };
};

export const stepEnvironment = (env: Environment, dt: number): void => {
  env.time += dt;
  const before = env.seaWind;
  env.seaWind = approach(env.seaWind, env.windSpeed, SEA_BUILD_RATE * dt * Math.max(1, Math.abs(env.windSpeed - env.seaWind)));
  if (before !== env.seaWind || env.time <= dt) env.waves = seaWaves(env.bands, { windSpeed: env.seaWind, swell: env.swell });
};

/** True wind at a height above the sea (power-law profile, exponent 0.11 over open water). */
export const windAt = (env: Environment, height: number): Wind2D => windVector(env.windDirection, env.windSpeed * Math.pow(Math.max(1, height) / 10, 0.11));
