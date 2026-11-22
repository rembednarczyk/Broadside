import { type Archipelago, DEEP_SEA, type Island, landAt } from "./archipelago";
import { FORT_CLASSES } from "../data/forts";
import { fortSites } from "./shores";

/**
 * The land as drawn (one source for the terrain mesh and what stands on it: towns, trees, forts).
 * Moved from the renderer (beta test 22.11): the forts were placed on the simulation's height,
 * below the drawn cliffs, so they hung half way up the cliff faces and sank into the hills.
 */
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

/** The land as the generator made it, through its drawn profile (forts are sited on this). */
export const naturalLand = (a: Archipelago, x: number, z: number): { y: number; island: Island | null } => {
  const l = landAt(a, x, z);
  return l ? { y: cliffProfile(l.island, l.height), island: l.island } : { y: DEEP_SEA, island: null };
};

/** Width (m) of the slope from a fort's level terrace back to the natural ground. */
const TERRACE_BLEND = 14;

interface Terrace {
  readonly x: number;
  readonly z: number;
  readonly y: number;
  readonly r: number;
}

const terraces = new WeakMap<Archipelago, Terrace[]>();
const terracesOf = (a: Archipelago): Terrace[] => {
  let t = terraces.get(a);
  if (!t) {
    t = fortSites(a).map((f) => ({ x: f.x, z: f.z, y: f.y, r: FORT_CLASSES[f.classId].radius + 4 }));
    terraces.set(a, t);
  }
  return t;
};

/**
 * The drawn land at a point: the highest landmass there, its height through its drawn profile,
 * levelled under each fort to the fort's terrace (cut into the hill, built up on the low side,
 * blended back over 14 m with a smoothstep), as the works of the period stood on a levelled
 * platform. The terrain mesh, the towns and the trees all stand on this.
 */
export const drawnLand = (a: Archipelago, x: number, z: number): { y: number; island: Island | null } => {
  const n = naturalLand(a, x, z);
  // The beach and the sea stay as they are: the coast the ships run onto is the simulation's.
  if (!n.island || n.y < BEACH) return n;
  let y = n.y;
  for (const t of terracesOf(a)) {
    const dx = x - t.x;
    const dz = z - t.z;
    const reach = t.r + TERRACE_BLEND;
    if (Math.abs(dx) > reach || Math.abs(dz) > reach) continue;
    const d = Math.hypot(dx, dz);
    if (d >= reach) continue;
    const u = d <= t.r ? 0 : (d - t.r) / TERRACE_BLEND;
    const w = 1 - u * u * (3 - 2 * u);
    y = y + (t.y - y) * w;
  }
  return { y, island: n.island };
};
