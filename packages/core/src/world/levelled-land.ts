import { type Archipelago, type Island } from "./archipelago";
import { FORT_CLASSES } from "../data/forts";
import { fortSites } from "./shores";
import { BEACH, naturalLand } from "./drawn-land";

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
