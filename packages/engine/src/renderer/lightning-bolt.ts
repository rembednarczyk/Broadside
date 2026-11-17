import { createRng, range } from "@broadside/core";

/**
 * A lightning stroke (pure, tested). Shape: midpoint displacement of the channel from the cloud
 * base to the sea, the method of Reed and Wyvill, "Visual Simulation of Lightning" (SIGGRAPH 1994):
 * each segment split and its midpoint pushed sideways by a share of its length; branches leave the
 * channel downwards at random points and are displaced the same way, shorter and thinner. The
 * random numbers come from the strike's position, so a strike looks the same on every run.
 * Brightness: a stroke is a few return strokes along the same channel a tenth of a second or so
 * apart (Uman, "The Lightning Discharge", 1987, ch. 1), so the flash flickers and then dies.
 */
export type Point = readonly [number, number, number];

export interface Bolt {
  /** The main channel from the cloud base to the water. */
  readonly channel: readonly Point[];
  /** Branches, each starting on the channel. */
  readonly branches: readonly (readonly Point[])[];
}

const displace = (from: Point, to: Point, levels: number, rough: number, next: () => number): Point[] => {
  let pts: Point[] = [from, to];
  for (let level = 0; level < levels; level++) {
    const out: Point[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]!;
      const b = pts[i + 1]!;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      const off = len * rough;
      out.push(a, [(a[0] + b[0]) / 2 + (next() - 0.5) * off, (a[1] + b[1]) / 2 + (next() - 0.5) * off * 0.3, (a[2] + b[2]) / 2 + (next() - 0.5) * off]);
    }
    out.push(pts[pts.length - 1]!);
    pts = out;
  }
  return pts;
};

/** The bolt striking the sea at (x, z) from a cloud base `height` metres up. */
export const lightningBolt = (x: number, z: number, height = 420): Bolt => {
  const rng = createRng(((Math.round(x) * 73856093) ^ (Math.round(z) * 19349663)) >>> 0);
  const next = (): number => rng.next();
  const top: Point = [x + range(rng, -60, 60), height, z + range(rng, -60, 60)];
  const channel = displace(top, [x, 0, z], 7, 0.22, next);
  const count = 2 + Math.floor(next() * 4);
  const branches: Point[][] = [];
  for (let b = 0; b < count; b++) {
    // From the upper two thirds of the channel, angled down and out, a quarter to a half as long.
    const at = channel[Math.floor((0.08 + next() * 0.55) * (channel.length - 1))]!;
    const length = height * (0.25 + next() * 0.25);
    const angle = next() * Math.PI * 2;
    const end: Point = [at[0] + Math.cos(angle) * length * 0.6, Math.max(0, at[1] - length), at[2] + Math.sin(angle) * length * 0.6];
    branches.push(displace(at, end, 5, 0.3, next));
  }
  return { channel, branches };
};

/** Return strokes: seconds after the first and their brightness. */
const STROKES: readonly (readonly [number, number])[] = [
  [0, 1],
  [0.11, 0.75],
  [0.26, 0.55],
];
const PULSE = 0.06;

/** Brightness of the flash `t` seconds after the strike (0 when it is over). */
export const flashCurve = (t: number): number => {
  if (t < 0) return 0;
  let f = 0;
  for (const [at, peak] of STROKES) if (t >= at) f = Math.max(f, peak * Math.exp(-(t - at) / PULSE));
  // The cloud stays lit faintly between the strokes and for a moment after.
  return Math.max(f, t < 0.45 ? 0.25 * (1 - t / 0.45) : 0);
};

/** Seconds a strike lasts on screen. */
export const STRIKE_LENGTH = 0.5;
