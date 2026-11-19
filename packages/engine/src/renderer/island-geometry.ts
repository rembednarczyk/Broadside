import { type Archipelago, DEEP_SEA, type Island, createRng, hashString, landAt, range } from "@broadside/core";

/**
 * The land's terrain in square chunks of a world grid (chunked terrain: Ulrich, "Rendering Massive
 * Terrains using Chunked Level of Detail Control", SIGGRAPH 2002, here with two levels per chunk
 * and skirts hiding the cracks where they meet), sampled from the same height function the
 * physics uses (core terrainHeight: the mainland, its peninsulas and the islands as one field),
 * coloured by height and slope: sand at the waterline, rock on steep faces, dark scrub and forest
 * above, pale sand under the shallows. Pure geometry, tested without a GPU.
 */
export interface TerrainGeometry {
  positions: number[];
  indices: number[];
  colors: number[];
}

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

/** Side of a chunk (m). */
export const CHUNK = 500;
/** Depth below which nothing is drawn (the seabed further down is never seen through the sea). */
const FLOOR = -25;
/** Depth the skirts hang below a chunk's edge (m), hiding the cracks between levels of detail. */
const SKIRT = 15;

/** The drawn land at a point: the highest landmass there, its height through its drawn profile. */
export const drawnLand = (a: Archipelago, x: number, z: number): { y: number; island: Island | null } => {
  const l = landAt(a, x, z);
  return l ? { y: cliffProfile(l.island, l.height), island: l.island } : { y: DEEP_SEA, island: null };
};

/**
 * One chunk's terrain (world coordinates) on a grid of `cells` × `cells`, or null when no land or
 * shallows rise above the floor in it. Cells wholly below the floor are left out.
 */
export const chunkGeometry = (a: Archipelago, x0: number, z0: number, cells: number): TerrainGeometry | null => {
  const n = cells + 1;
  const step = CHUNK / cells;
  const ys = new Float32Array(n * n);
  const owner: (Island | null)[] = [];
  let any = false;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const s = drawnLand(a, x0 + i * step, z0 + j * step);
      ys[j * n + i] = s.y;
      owner.push(s.island);
      if (s.y > FLOOR) any = true;
    }
  }
  if (!any) return null;
  const y = (i: number, j: number): number => ys[Math.min(n - 1, Math.max(0, j)) * n + Math.min(n - 1, Math.max(0, i))]!;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const fallback = a.islands[0]!;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const h = y(i, j);
      const slope = Math.hypot(y(i + 1, j) - y(i - 1, j), y(i, j + 1) - y(i, j - 1)) / (2 * step);
      positions.push(x0 + i * step, Math.max(h, FLOOR), z0 + j * step);
      colors.push(...colour(owner[j * n + i] ?? fallback, h, slope), 1);
    }
  }
  // Wound so the faces look up (Babylon's front faces, its left-handed normals).
  for (let j = 0; j < cells; j++) {
    for (let i = 0; i < cells; i++) {
      const a0 = j * n + i;
      if (Math.max(ys[a0]!, ys[a0 + 1]!, ys[a0 + n]!, ys[a0 + n + 1]!) <= FLOOR) continue;
      indices.push(a0, a0 + 1, a0 + n, a0 + 1, a0 + n + 1, a0 + n);
    }
  }
  // Skirts: the border's vertices again, SKIRT lower, joined to the border, wound both ways (the
  // crack is seen from either side).
  const ring: number[] = [];
  for (let i = 0; i < cells; i++) ring.push(i);
  for (let j = 0; j < cells; j++) ring.push(j * n + cells);
  for (let i = cells; i > 0; i--) ring.push(cells * n + i);
  for (let j = cells; j > 0; j--) ring.push(j * n);
  const base = positions.length / 3;
  ring.forEach((v) => {
    positions.push(positions[v * 3]!, positions[v * 3 + 1]! - SKIRT, positions[v * 3 + 2]!);
    colors.push(colors[v * 4]!, colors[v * 4 + 1]!, colors[v * 4 + 2]!, 1);
  });
  ring.forEach((v, k) => {
    const w = ring[(k + 1) % ring.length]!;
    if (Math.max(ys[v]!, ys[w]!) <= FLOOR) return;
    const v2 = base + k;
    const w2 = base + ((k + 1) % ring.length);
    indices.push(v, w, v2, w, w2, v2, v, v2, w, w, v2, w2);
  });
  return { positions, indices, colors };
};

/** Chunks (their south-west corners) that may hold land: the sea's square and a margin beyond it, where the mainland runs on. */
export const chunkCorners = (a: Archipelago, margin: number): { x: number; z: number }[] => {
  const out: { x: number; z: number }[] = [];
  const lo = Math.floor((-a.half - margin) / CHUNK);
  const hi = Math.ceil((a.half + margin) / CHUNK);
  for (let j = lo; j < hi; j++) for (let i = lo; i < hi; i++) out.push({ x: i * CHUNK, z: j * CHUNK });
  return out;
};

/** A tree on the land: where it stands, its turn, size and tint, and which model (palm or broadleaf). */
export interface TreeSpot {
  x: number;
  y: number;
  z: number;
  scale: number;
  yaw: number;
  /** 0..1, the shade of its leaves (instances differ, as real stands do). */
  tint: number;
  palm: boolean;
}

/** Height (m) up to which jungle land grows palms: the coconut fringe behind the beach, broadleaf forest above. */
export const PALM_BELT = 14;
/** Share of the candidate spots each kind of land keeps (dense jungle, open beaches, bare cliffs). */
const COVER: Record<Island["kind"], number> = { jungle: 1, beach: 0.45, cliff: 0.2 };

/** Trees in a chunk (deterministic from the world's seed and the chunk): on land above the beach, not on steep rock. */
export const chunkTrees = (a: Archipelago, x0: number, z0: number, max: number): TreeSpot[] => {
  const rng = createRng(hashString(`trees-${a.seed}-${x0}-${z0}`));
  const out: TreeSpot[] = [];
  for (let k = 0; k < max; k++) {
    const x = x0 + rng.next() * CHUNK;
    const z = z0 + rng.next() * CHUNK;
    const scale = range(rng, 0.7, 1.4);
    const yaw = range(rng, 0, Math.PI * 2);
    const tint = rng.next();
    const keep = rng.next();
    const s = drawnLand(a, x, z);
    if (!s.island || s.y < 2.5 || keep > COVER[s.island.kind]) continue;
    const slope = Math.abs(drawnLand(a, x + 3, z).y - s.y) / 3;
    if (slope > 1.1) continue;
    out.push({ x, y: s.y, z, scale, yaw, tint, palm: s.island.kind === "beach" || (s.island.kind === "jungle" && s.y < PALM_BELT) });
  }
  return out;
};
