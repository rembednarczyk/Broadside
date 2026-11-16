import { hashString } from "./rng";
import { smoothstep } from "./scalar";

/**
 * Seeded value noise in 1D and 2D (lattice hash + smoothstep interpolation, the classic
 * "value noise" of Perlin's era). Used for weather fronts, gusts and island shapes.
 */
const lattice = (seed: number, ix: number, iy: number): number => {
  let h = (seed ^ Math.imul(ix, 0x27d4eb2d) ^ Math.imul(iy, 0x165667b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

export const noise2 = (seed: number, x: number, y: number): number => {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smoothstep(0, 1, x - ix);
  const fy = smoothstep(0, 1, y - iy);
  const a = lattice(seed, ix, iy);
  const b = lattice(seed, ix + 1, iy);
  const c = lattice(seed, ix, iy + 1);
  const d = lattice(seed, ix + 1, iy + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
};

export const noise1 = (seed: number, x: number): number => noise2(seed, x, 0.5);

/** Fractal sum of octaves, normalised to [0, 1). */
export const fbm2 = (seed: number, x: number, y: number, octaves: number): number => {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let f = 1;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise2(seed + o * 1013, x * f, y * f);
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
};

export const seedOf = (name: string): number => hashString(name);
