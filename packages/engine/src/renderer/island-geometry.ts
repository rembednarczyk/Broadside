import { type Island, createRng, islandHeight, range } from "@broadside/core";

/**
 * Island terrain as a radial grid (rings denser near the shore, where the shape matters) sampled
 * from the same height function the physics uses, coloured by height and slope: sand at the
 * waterline, rock on steep faces, dark scrub and forest above, pale sand under the shallows.
 * Pure geometry, tested without a GPU.
 */
export interface TerrainGeometry {
  positions: number[];
  indices: number[];
  colors: number[];
}

const RINGS = 48;
const SEGMENTS = 96;

type Rgb = readonly [number, number, number];
const SAND: Rgb = [0.62, 0.55, 0.42];
const WET: Rgb = [0.4, 0.36, 0.28];
const ROCK: Rgb = [0.36, 0.33, 0.3];
const SCRUB: Rgb = [0.26, 0.29, 0.18];
const FOREST: Rgb = [0.14, 0.2, 0.11];
const SEABED: Rgb = [0.5, 0.48, 0.38];

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const sat = (v: number): number => Math.max(0, Math.min(1, v));

const colour = (is: Island, h: number, slope: number): Rgb => {
  if (h < -1.5) return mix(SEABED, WET, sat(1 + h / 12));
  if (h < 1.2) return mix(WET, SAND, sat((h + 1.5) / 2.7));
  if (slope > 0.9) return ROCK;
  const top = is.kind === "jungle" ? FOREST : SCRUB;
  const ground = mix(SAND, top, sat((h - 1.2) / 6));
  return mix(ground, ROCK, sat((slope - 0.45) / 0.45));
};

/** Height of the beach the waves wash (m): below it the shore keeps the simulation's slope. */
const BEACH = 0.8;

/**
 * The land drawn as sea cliffs (the reference's coast, ref_095 and ref_176: a narrow beach, a
 * steep wall, a flat top): above the beach the height is remapped by a concave curve
 * 1 - (1 - u)^n of its share of the island's height, so the land rises n times as steeply at the
 * shore and flattens over the top, the summit where it was. Drawing only: the waterline (height 0),
 * the shoals and the land the ships run onto stay the simulation's (islandHeight, core), so the
 * coast the player sees ends where the physics' does. n = 5 for the cliff islands, 3 for the rest.
 */
export const cliffProfile = (is: Island, y: number): number => {
  if (y <= BEACH) return y;
  const top = Math.max(is.height, BEACH + 1);
  const u = (y - BEACH) / (top - BEACH);
  if (u >= 1) return y;
  const n = is.kind === "cliff" ? 5 : 3;
  return BEACH + (top - BEACH) * (1 - Math.pow(1 - u, n));
};

export const islandGeometry = (is: Island): TerrainGeometry => {
  const reach = is.radius * 1.3 + is.shoal * 0.6;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const h = (x: number, z: number): number => cliffProfile(is, islandHeight(is, is.x + x, is.z + z));
  positions.push(0, h(0, 0), 0);
  colors.push(...colour(is, h(0, 0), 0), 1);
  for (let r = 1; r <= RINGS; r++) {
    const rr = reach * Math.pow(r / RINGS, 0.8);
    for (let s = 0; s < SEGMENTS; s++) {
      const a = (s / SEGMENTS) * Math.PI * 2;
      const x = Math.cos(a) * rr;
      const z = Math.sin(a) * rr;
      const y = h(x, z);
      const e = 1.5;
      const slope = Math.hypot(h(x + e, z) - h(x - e, z), h(x, z + e) - h(x, z - e)) / (2 * e);
      positions.push(x, Math.max(y, -25), z);
      colors.push(...colour(is, y, slope), 1);
    }
  }
  for (let s = 0; s < SEGMENTS; s++) indices.push(0, 1 + ((s + 1) % SEGMENTS), 1 + s);
  for (let r = 1; r < RINGS; r++) {
    const a0 = 1 + (r - 1) * SEGMENTS;
    const b0 = 1 + r * SEGMENTS;
    for (let s = 0; s < SEGMENTS; s++) {
      const s1 = (s + 1) % SEGMENTS;
      indices.push(a0 + s, a0 + s1, b0 + s, a0 + s1, b0 + s1, b0 + s);
    }
  }
  return { positions, indices, colors };
};

/** Tree positions on an island (deterministic): only on land above the beach and not too steep. */
export const treeSpots = (is: Island, max: number): { x: number; y: number; z: number; scale: number }[] => {
  if (is.kind === "cliff" && max > 0) max = Math.floor(max * 0.4);
  const rng = createRng(is.seed);
  const out: { x: number; y: number; z: number; scale: number }[] = [];
  for (let i = 0; i < max * 4 && out.length < max; i++) {
    const a = range(rng, 0, Math.PI * 2);
    const d = Math.sqrt(rng.next()) * is.radius;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    // On the drawn land (cliffProfile), the same as the terrain's mesh.
    const y = cliffProfile(is, islandHeight(is, is.x + x, is.z + z));
    if (y < 2.5) continue;
    out.push({ x, y, z, scale: range(rng, 0.7, 1.4) });
  }
  return out;
};
