import { type Rng, createRng, hashString, pick, range } from "../math/rng";
import { fbm2, ridged2 } from "../math/noise";
import { clamp, smoothstep } from "../math/scalar";

/**
 * The sea and its land: a stretch of mainland coast along one side of the sea, peninsulas
 * reaching from it, and islands placed by Poisson-disc sampling (Bridson, "Fast Poisson Disk
 * Sampling in Arbitrary Dimensions", 2007) so they never crowd. Every landmass is one shape: a
 * capsule (the points within a radius of a segment, its spine; a point for a round island), its
 * coastline pushed in and out by fractal noise (bays and headlands), its land raised by noise
 * and ridges. Overlapping shapes unite (the land is the highest of them), so a peninsula grows
 * out of the mainland and two close islands make one. A shape is the signed-distance modelling
 * of Quilez ("Distance functions", the capsule) with the coast as a noise-displaced isoline;
 * one function shared by the simulation (seabed, grounding, pilotage) and the renderer (land,
 * shallows, chart). Deterministic from the seed: the same world every time for a save.
 */
export type IslandKind = "cliff" | "beach" | "jungle";
/** A round or long island, a peninsula of the mainland, or the mainland itself. */
export type LandForm = "island" | "peninsula" | "mainland";

export interface Island {
  readonly id: number;
  /** Centre of the spine. */
  readonly x: number;
  readonly z: number;
  /** Half-width of the land at sea level (metres; the radius of a round island). */
  readonly radius: number;
  /** Highest point of the land. */
  readonly height: number;
  readonly kind: IslandKind;
  /** Seed of the island's own noise. */
  readonly seed: number;
  /** Width of the reef and shoal ring around the shore. */
  readonly shoal: number;
  /** Half the spine (the spine runs from centre - this to centre + this); none: round. */
  readonly spine?: { readonly dx: number; readonly dz: number };
  readonly form?: LandForm;
  /** How far the coastline wanders in and out (share of the radius; 0.5 by default). */
  readonly rough?: number;
}

export interface Archipelago {
  readonly seed: number;
  /** Half size of the square sea (metres). */
  readonly half: number;
  readonly islands: readonly Island[];
}

/**
 * Version of the land the generator makes from a seed: bumped whenever it changes (a saved game
 * from an older world has its ships moved off the new land and its forts rebuilt, sim restore).
 * 2: the mainland, peninsulas and long islands (19.11).
 */
export const WORLD_VERSION = 2;

/** Depth of open sea (metres below the surface). */
export const DEEP_SEA = -60;

const KINDS: readonly IslandKind[] = ["cliff", "cliff", "beach", "jungle"];

/** Nearest point of the island's spine to (x, z), and the spine's parameter there (-1..1). */
export const spinePoint = (is: Island, x: number, z: number): { x: number; z: number; t: number } => {
  const sx = is.spine?.dx ?? 0;
  const sz = is.spine?.dz ?? 0;
  const len2 = sx * sx + sz * sz;
  const t = len2 > 0 ? clamp(((x - is.x) * sx + (z - is.z) * sz) / len2, -1, 1) : 0;
  return { x: is.x + sx * t, z: is.z + sz * t, t };
};

/** The spine's point at parameter t (-1..1). */
export const spineAt = (is: Island, t: number): { x: number; z: number } => ({ x: is.x + (is.spine?.dx ?? 0) * t, z: is.z + (is.spine?.dz ?? 0) * t });

/** Half-length of the spine (m). */
export const spineLength = (is: Island): number => Math.hypot(is.spine?.dx ?? 0, is.spine?.dz ?? 0);

/** Distance from (x, z) to the island's mean shore (m; negative inland), without the coast's wander. */
export const shoreDistance = (is: Island, x: number, z: number): number => {
  const p = spinePoint(is, x, z);
  return Math.hypot(x - p.x, z - p.z) - is.radius;
};

/** How far from its spine an island's land and shoals reach at most (m). */
export const islandReach = (is: Island): number => is.radius * (1 + (is.rough ?? 0.5) * 0.6) + is.shoal + 80;

const poissonDisc = (rng: Rng, half: number, minDist: number, keepOut: number, tries = 30): { x: number; z: number }[] => {
  const pts: { x: number; z: number }[] = [];
  const active: { x: number; z: number }[] = [];
  const start = { x: range(rng, -half * 0.5, half * 0.5), z: range(rng, -half * 0.5, half * 0.5) };
  if (Math.hypot(start.x, start.z) > keepOut) {
    pts.push(start);
    active.push(start);
  } else {
    const p = { x: keepOut + minDist, z: 0 };
    pts.push(p);
    active.push(p);
  }
  while (active.length > 0) {
    const i = Math.floor(rng.next() * active.length);
    const base = active[i]!;
    let found = false;
    for (let t = 0; t < tries; t++) {
      const a = rng.next() * Math.PI * 2;
      const r = minDist * (1 + rng.next());
      const c = { x: base.x + Math.cos(a) * r, z: base.z + Math.sin(a) * r };
      if (Math.abs(c.x) > half * 0.92 || Math.abs(c.z) > half * 0.92 || Math.hypot(c.x, c.z) < keepOut) continue;
      if (pts.every((p) => Math.hypot(p.x - c.x, p.z - c.z) >= minDist)) {
        pts.push(c);
        active.push(c);
        found = true;
        break;
      }
    }
    if (!found) active.splice(i, 1);
  }
  return pts;
};

const heightOf = (rng: Rng, kind: IslandKind): number => (kind === "cliff" ? range(rng, 60, 140) : kind === "jungle" ? range(rng, 40, 110) : range(rng, 8, 25));

/** The mainland's half-width: its spine lies this far behind the mean coastline. */
const MAINLAND_RADIUS = 1700;

/**
 * The mainland along one side of the sea (which side from the seed): a capsule whose spine runs
 * parallel to that edge well beyond it, so only its coast, wandering in deep bays and long
 * headlands (rough 1, six octaves), and the land rising behind it lie in the sea's square.
 */
const mainland = (rng: Rng, seed: number, half: number): { land: Island; normal: { x: number; z: number }; coast: number } => {
  const side = Math.floor(rng.next() * 4);
  const normal = [{ x: 0, z: 1 }, { x: 1, z: 0 }, { x: 0, z: -1 }, { x: -1, z: 0 }][side]!;
  const coast = half * range(rng, 0.45, 0.55);
  const d = coast + MAINLAND_RADIUS;
  const land: Island = { id: 0, x: normal.x * d, z: normal.z * d, radius: MAINLAND_RADIUS, height: range(rng, 110, 170), kind: "jungle", seed: hashString(`mainland-${seed}`), shoal: range(rng, 60, 110), spine: { dx: -normal.z * half * 2.4, dz: normal.x * half * 2.4 }, form: "mainland", rough: 1 };
  return { land, normal, coast };
};

/**
 * Peninsulas: two or three long arms from the mainland into the sea, rooted behind its coast,
 * their tips kept clear of the start area.
 */
const peninsulas = (rng: Rng, seed: number, half: number, m: { normal: { x: number; z: number }; coast: number }, clear: number): Island[] => {
  const out: Island[] = [];
  const count = 2 + Math.floor(rng.next() * 2);
  const along = { x: -m.normal.z, z: m.normal.x };
  for (let i = 0; i < count; i++) {
    // Spread along the coast: one per stretch, placed at random within it.
    const u = -half * 0.8 + ((i + range(rng, 0.2, 0.8)) / count) * half * 1.6;
    const kind = pick(rng, KINDS);
    const radius = range(rng, 90, 170);
    const turn = range(rng, -0.55, 0.55);
    const dir = { x: -m.normal.x * Math.cos(turn) - along.x * Math.sin(turn), z: -m.normal.z * Math.cos(turn) - along.z * Math.sin(turn) };
    const root = { x: along.x * u + m.normal.x * (m.coast + 300), z: along.z * u + m.normal.z * (m.coast + 300) };
    let length = range(rng, 1400, 2400);
    const shoal = kind === "beach" ? range(rng, 70, 140) : range(rng, 30, 70);
    // The knee (the first piece's end) kept clear of the start area; the outer piece is checked below.
    while (length > 400 && Math.hypot(root.x + dir.x * length * 0.55, root.z + dir.z * length * 0.55) < clear + radius * 1.3 + shoal + 80) length -= 50;
    const h = heightOf(rng, kind);
    // Two pieces bent at a knee, the outer one narrower (an arm of land tapers and curves).
    const bend = range(rng, -0.7, 0.7);
    const l1 = length * 0.55;
    const knee = { x: root.x + dir.x * l1, z: root.z + dir.z * l1 };
    const dir2 = { x: dir.x * Math.cos(bend) - dir.z * Math.sin(bend), z: dir.x * Math.sin(bend) + dir.z * Math.cos(bend) };
    const l2 = length * 0.5;
    const piece = (from: { x: number; z: number }, d: { x: number; z: number }, l: number, r: number, k: number): Island => ({ id: 0, x: from.x + (d.x * l) / 2, z: from.z + (d.z * l) / 2, radius: r, height: h, kind, seed: hashString(`peninsula-${seed}-${i}-${k}`), shoal, spine: { dx: (d.x * l) / 2, dz: (d.z * l) / 2 }, form: "peninsula", rough: 0.75 });
    out.push(piece(root, dir, l1, radius, 0));
    // The outer piece only if its tip stays clear of the start area.
    const tip2 = { x: knee.x + dir2.x * l2, z: knee.z + dir2.z * l2 };
    if (Math.hypot(tip2.x, tip2.z) > clear + radius * 1.3 + shoal + 80) out.push(piece(knee, dir2, l2, radius * 0.75, 1));
  }
  return out;
};

/**
 * Generates the sea's land. The start area around the origin is kept open water (the player
 * starts there); islands keep clear of the mainland and its peninsulas (a sound between them).
 */
export const generateArchipelago = (seed: number, half = 4000, spacing = 900, startClear = 700): Archipelago => {
  const rng = createRng(hashString(`archipelago-${seed}`));
  const m = mainland(rng, seed, half);
  const arms = peninsulas(rng, seed, half, m, startClear);
  // An island reaches up to its spine plus 1.3 radius and its shoal: keep centres far enough
  // for the whole reach to stay clear of the start area.
  const pts = poissonDisc(rng, half, spacing, startClear + 260 * 1.3 + 140 + 80);
  const islands: Island[] = [];
  for (const p of pts) {
    const kind = pick(rng, KINDS);
    const radius = range(rng, 90, 260);
    const height = heightOf(rng, kind);
    const shoal = kind === "beach" ? range(rng, 70, 140) : range(rng, 30, 70);
    // Some islands are long (a ridge, a cay): a spine up to 1.8 radii, at any bearing.
    const long = rng.next() < 0.45 ? range(rng, 0.5, 1.8) * radius : 0;
    const bearing = range(rng, 0, Math.PI);
    const reach = radius * 1.3 + shoal + 80 + long;
    const sound = (o: Island) => shoreDistance(o, p.x, p.z) - o.radius * 0.3 - o.shoal - reach;
    if (Math.hypot(p.x, p.z) - long < startClear + radius * 1.3 + shoal + 80) continue;
    if (sound(m.land) < 150 || arms.some((o) => sound(o) < 150)) continue;
    islands.push({ id: 0, x: p.x, z: p.z, radius, height, kind, seed: hashString(`island-${seed}-${islands.length}`), shoal, ...(long > 0 ? { spine: { dx: Math.cos(bearing) * long, dz: Math.sin(bearing) * long } } : {}), form: "island", rough: 0.75 });
  }
  return { seed, half, islands: [m.land, ...arms, ...islands].map((is, id) => ({ ...is, id })) };
};

/**
 * Terrain height of one landmass at a world point (metres; negative under water). The coast is
 * the isoline where the distance to the spine equals the radius times a noise in space (bays and
 * headlands); cliff land rises in a steep step to a rolling plateau (the reference's flat-topped
 * headlands), beaches slope gently, jungle land makes rounded hills.
 */
export const islandHeight = (is: Island, x: number, z: number): number => {
  const s = spinePoint(is, x, z);
  const d = Math.hypot(x - s.x, z - s.z);
  const rough = is.rough ?? 0.5;
  const reach = is.radius * (1 + rough * 0.6) + is.shoal + 80;
  if (d > reach) return DEEP_SEA;
  // The coast's wander from noise in space, at a scale of the island's size (features of about
  // half a radius; the mainland, rougher, down to coves a few dozen metres across).
  const f = 1.8 / is.radius;
  const wobble = 1 + rough * (fbm2(is.seed, x * f + 5, z * f + 5, rough >= 1 ? 6 : 4) - 0.5) * 2;
  const r = is.radius * wobble;
  const t = d / r;
  // Under water: from the shore down over the shoal to the deep.
  const sea = DEEP_SEA + (1 - smoothstep(1, 1 + is.shoal / r, t)) * (-DEEP_SEA - 1.5);
  if (t >= 1) return sea;
  // Inland the land rises over a few hundred metres (an island's whole width at most), the
  // mainland's over 1.2 km: a coastal plain and foothills, not a wall of peaks at the shore.
  const inland = Math.min(1, ((1 - t) * r) / (is.form === "mainland" ? 1200 : Math.min(r, 420)));
  const n = fbm2(is.seed + 7, x * 0.006, z * 0.006, 4);
  // Domain warp (Quilez) bends the ridges so they wander like real spurs and gullies.
  const wx = x * 0.011 + 2.5 * fbm2(is.seed + 21, x * 0.004, z * 0.004, 2);
  const wz = z * 0.011 + 2.5 * fbm2(is.seed + 22, x * 0.004, z * 0.004, 2);
  const ridges = ridged2(is.seed + 13, wx, wz, 4);
  if (is.kind === "cliff") {
    const edge = smoothstep(0, 0.1, inland);
    // Plateau with gullies cut into it.
    return -1.5 + edge * is.height * (0.72 + 0.3 * n - 0.22 * (1 - ridges));
  }
  const peak = Math.pow(clamp(inland, 0, 1), 1.1);
  if (is.kind === "beach") return -1.5 + (1 - (1 - inland) * (1 - inland)) * is.height * (0.45 + 0.4 * n + 0.35 * ridges * peak);
  return -1.5 + is.height * (peak * (0.35 + 0.45 * n) + 0.45 * ridges * Math.sqrt(peak));
};

/** Terrain height of the whole world at a point (the highest landmass there, or the deep sea). */
export const terrainHeight = (a: Archipelago, x: number, z: number): number => {
  let h = DEEP_SEA;
  for (const is of a.islands) {
    const reach = islandReach(is) + spineLength(is);
    if (Math.abs(x - is.x) > reach || Math.abs(z - is.z) > reach) continue;
    h = Math.max(h, islandHeight(is, x, z));
  }
  return h;
};

/** The landmass whose land stands highest at a point (null over the deep sea). */
export const landAt = (a: Archipelago, x: number, z: number): { island: Island; height: number } | null => {
  let best: { island: Island; height: number } | null = null;
  for (const is of a.islands) {
    const reach = islandReach(is) + spineLength(is);
    if (Math.abs(x - is.x) > reach || Math.abs(z - is.z) > reach) continue;
    const h = islandHeight(is, x, z);
    if (h > DEEP_SEA && (!best || h > best.height)) best = { island: is, height: h };
  }
  return best;
};

