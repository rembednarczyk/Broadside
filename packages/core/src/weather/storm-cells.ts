import { type WeatherKind } from "./weather";

/**
 * Storm cells: the local side of the weather. A convective cell (a squall under a towering
 * cumulonimbus) is modelled the way forecasters sketch it, a moving disturbance whose strength
 * falls off from its core (a Gaussian profile, as in idealised squall models) and grows and
 * decays over its life. Ships inside feel stronger wind, rain and poorer sight; outside, the
 * weather of the whole sea (the Markov chain in weather.ts) still rules.
 */
export interface StormCell {
  x: number;
  z: number;
  readonly radius: number;
  /** Peak strength 0..1 at the core. */
  readonly strength: number;
  age: number;
  readonly life: number;
}

export const CELLS = {
  /** Seconds to build up and to die away. */
  ramp: 60,
  /** Share of the wind speed a cell drifts at (it rides the steering wind). */
  drift: 0.6,
  /** Extra wind at the core, as a share of the wind speed. */
  gust: 0.8,
} as const;

/** How many cells a kind of weather breeds at most, and how strong they come. */
export const CELL_CLIMATE: Readonly<Record<WeatherKind, { readonly max: number; readonly strength: number; readonly perMinute: number }>> = {
  calm: { max: 0, strength: 0, perMinute: 0 },
  breeze: { max: 1, strength: 0.4, perMinute: 0.05 },
  fresh: { max: 1, strength: 0.6, perMinute: 0.1 },
  squally: { max: 3, strength: 0.9, perMinute: 0.4 },
  gale: { max: 2, strength: 0.8, perMinute: 0.25 },
  storm: { max: 3, strength: 1, perMinute: 0.3 },
  fog: { max: 0, strength: 0, perMinute: 0 },
  rain: { max: 2, strength: 0.7, perMinute: 0.25 },
};

const envelope = (c: StormCell): number => Math.max(0, Math.min(1, c.age / CELLS.ramp, (c.life - c.age) / CELLS.ramp));

/** Strength 0..1 of the strongest cell over a point. */
export const cellInfluence = (cells: readonly StormCell[], x: number, z: number): number => {
  let best = 0;
  for (const c of cells) {
    const d2 = ((x - c.x) ** 2 + (z - c.z) ** 2) / (c.radius * c.radius);
    best = Math.max(best, c.strength * envelope(c) * Math.exp(-2 * d2));
  }
  return best;
};

/** Moves the cells down the wind and ages them; returns the cells still alive. */
export const driftCells = (cells: readonly StormCell[], windDirection: number, windSpeed: number, dt: number): StormCell[] => {
  const vx = Math.sin(windDirection) * windSpeed * CELLS.drift;
  const vz = Math.cos(windDirection) * windSpeed * CELLS.drift;
  for (const c of cells) {
    c.x += vx * dt;
    c.z += vz * dt;
    c.age += dt;
  }
  return cells.filter((c) => c.age < c.life);
};
