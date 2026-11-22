import { type Rng, range } from "../math/rng";
import { approach, clamp, wrapAngle } from "../math/scalar";
import { noise1 } from "../math/noise";

/**
 * Weather as a Markov chain of states (a weighted transition table, data-driven like a Type
 * Object) with continuous parameters that ease towards each state's targets (first-order lag).
 * The state picks what kind of weather comes; wind, cloud, rain and fog change smoothly.
 */
export type WeatherKind = "calm" | "breeze" | "fresh" | "squally" | "gale" | "storm" | "fog" | "rain";

export interface WeatherDef {
  /** Wind speed range in m/s. */
  readonly wind: readonly [number, number];
  readonly overcast: number;
  readonly rain: number;
  readonly fog: number;
  /** Gust amplitude as a share of the wind. */
  readonly gust: number;
  /** Lightning strikes per minute somewhere near the player. */
  readonly lightning: number;
  /** Chance per minute that a waterspout forms. */
  readonly spouts: number;
  /** Chance per minute of a rogue wave group. */
  readonly rogue: number;
  /** Chance per minute of a squall (a short, violent rise of the wind). */
  readonly squalls: number;
  /** Duration range in minutes. */
  readonly minutes: readonly [number, number];
  /** Next states with weights. */
  readonly next: Readonly<Partial<Record<WeatherKind, number>>>;
}

export const WEATHER: Readonly<Record<WeatherKind, WeatherDef>> = {
  calm: { wind: [0.5, 2.5], overcast: 0.1, rain: 0, fog: 0.15, gust: 0.1, lightning: 0, spouts: 0, rogue: 0, squalls: 0, minutes: [3, 6], next: { breeze: 3, fog: 2 } },
  breeze: { wind: [4, 7], overcast: 0.25, rain: 0, fog: 0, gust: 0.15, lightning: 0, spouts: 0, rogue: 0, squalls: 0.02, minutes: [5, 10], next: { fresh: 3, calm: 1, fog: 1, rain: 1 } },
  fresh: { wind: [8, 11], overcast: 0.45, rain: 0, fog: 0, gust: 0.2, lightning: 0, spouts: 0.02, rogue: 0.02, squalls: 0.08, minutes: [5, 10], next: { breeze: 2, squally: 2, rain: 2, gale: 1 } },
  squally: { wind: [9, 13], overcast: 0.65, rain: 0.35, fog: 0.05, gust: 0.35, lightning: 0.3, spouts: 0.12, rogue: 0.04, squalls: 0.5, minutes: [3, 6], next: { fresh: 2, gale: 1, rain: 1 } },
  gale: { wind: [15, 19], overcast: 0.8, rain: 0.5, fog: 0.1, gust: 0.25, lightning: 0.6, spouts: 0.06, rogue: 0.15, squalls: 0.2, minutes: [5, 9], next: { storm: 1, squally: 2, fresh: 1 } },
  storm: { wind: [21, 27], overcast: 1, rain: 0.9, fog: 0.25, gust: 0.3, lightning: 2.5, spouts: 0.1, rogue: 0.35, squalls: 0.3, minutes: [5, 8], next: { gale: 3 } },
  fog: { wind: [1.5, 4], overcast: 0.6, rain: 0, fog: 0.85, gust: 0.1, lightning: 0, spouts: 0, rogue: 0, squalls: 0, minutes: [3, 6], next: { breeze: 2, calm: 1 } },
  rain: { wind: [6, 10], overcast: 0.75, rain: 0.7, fog: 0.15, gust: 0.25, lightning: 0.1, spouts: 0.03, rogue: 0.02, squalls: 0.15, minutes: [3, 6], next: { fresh: 2, breeze: 1, squally: 1 } },
};

export interface WeatherState {
  kind: WeatherKind;
  /** Seconds left in the current state. */
  left: number;
  /** Mean wind the state aims at (m/s). */
  targetWind: number;
  /** Current mean wind (without gusts). */
  meanWind: number;
  overcast: number;
  rain: number;
  fog: number;
  gust: number;
  /** Seconds left of a running squall (0 = none) and its full length. */
  squall: number;
  squallLength: number;
  /** Prevailing wind direction (towards), slowly veering. */
  direction: number;
  readonly seed: number;
}

export const createWeather = (kind: WeatherKind, direction: number, seed: number, rng: Rng): WeatherState => {
  const d = WEATHER[kind];
  const w = range(rng, d.wind[0], d.wind[1]);
  return { kind, left: range(rng, d.minutes[0], d.minutes[1]) * 60, targetWind: w, meanWind: w, overcast: d.overcast, rain: d.rain, fog: d.fog, gust: d.gust, squall: 0, squallLength: 1, direction, seed };
};

/** Weighted pick of the next state (roulette wheel selection). */
export const nextKind = (kind: WeatherKind, rng: Rng): WeatherKind => {
  const entries = Object.entries(WEATHER[kind].next) as [WeatherKind, number][];
  const total = entries.reduce((a, [, w]) => a + w, 0);
  let r = rng.next() * total;
  for (const [k, w] of entries) {
    r -= w;
    if (r <= 0) return k;
  }
  return entries[entries.length - 1]![0];
};

/** Events the weather produces in a step; the simulation turns them into effects on ships. */
export interface WeatherTick {
  readonly changed: WeatherKind | null;
  readonly lightning: boolean;
  readonly spout: boolean;
  readonly rogue: boolean;
  readonly squallStarted: boolean;
}

/**
 * Per-second rates of the slow parameters (first-order lags). The wind's makes a change of state a
 * blow that builds over two to four minutes (at 0.06 a fresh breeze became a storm in about 80 s,
 * beta test 19.11); gales and storms last five to nine minutes, not two to four, and their
 * coming is called out (weatherChanged, the HUD's notice) while the wind is still rising.
 */
const EASE = { wind: 0.01, cloud: 0.012, rain: 0.02, fog: 0.008 } as const;

export const stepWeather = (w: WeatherState, time: number, dt: number, rng: Rng): WeatherTick => {
  let changed: WeatherKind | null = null;
  w.left -= dt;
  if (w.left <= 0) {
    w.kind = nextKind(w.kind, rng);
    const d = WEATHER[w.kind];
    w.left = range(rng, d.minutes[0], d.minutes[1]) * 60;
    w.targetWind = range(rng, d.wind[0], d.wind[1]);
    changed = w.kind;
  }
  const d = WEATHER[w.kind];
  w.meanWind = approach(w.meanWind, w.targetWind, EASE.wind * dt * Math.max(1, Math.abs(w.targetWind - w.meanWind)));
  w.overcast = approach(w.overcast, d.overcast, EASE.cloud * dt);
  w.rain = approach(w.rain, d.rain, EASE.rain * dt);
  w.fog = approach(w.fog, d.fog, EASE.fog * dt);
  w.gust = approach(w.gust, d.gust, 0.05 * dt);
  // The wind veers slowly back and forth (value noise over minutes).
  w.direction = wrapAngle(w.direction + (noise1(w.seed, time / 240) - 0.5) * 0.004 * dt);
  const perMin = dt / 60;
  const squallStarted = w.squall <= 0 && rng.next() < d.squalls * perMin;
  if (squallStarted) {
    w.squall = range(rng, 40, 90);
    w.squallLength = w.squall;
  }
  if (w.squall > 0) w.squall = Math.max(0, w.squall - dt);
  return {
    changed,
    lightning: rng.next() < d.lightning * perMin,
    spout: rng.next() < d.spouts * perMin,
    rogue: rng.next() < d.rogue * perMin,
    squallStarted,
  };
};

/** Wind actually blowing now: mean wind, gusts from noise and a squall's rise and fall. */
export const windNow = (w: WeatherState, time: number): number => {
  const gust = (noise1(w.seed + 7, time / 6) - 0.5) * 2 * w.gust;
  // A squall rises and falls over its length (half a sine).
  const squall = w.squall > 0 ? Math.sin((1 - w.squall / w.squallLength) * Math.PI) * 0.9 : 0;
  return clamp(w.meanWind * (1 + gust + squall), 0, 40);
};
