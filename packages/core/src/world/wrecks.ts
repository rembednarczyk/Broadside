import { createRng, hashString, range } from "../math/rng";
import { type Archipelago, portSites, terrainHeight } from "./archipelago";

/**
 * Wrecks stranded on the shoals (scenery placed by the seed, like the islands: the same wrecks in
 * the same world). About two islands in five have one, where the shoal shelves to a stranding depth
 * on a random bearing from the island, clear of the ports. A wreck lies heeled on its bilge at a
 * random heading, part buried.
 */
export interface WreckSite {
  readonly x: number;
  readonly z: number;
  /** Seabed height there (m, negative). */
  readonly seabed: number;
  /** Heading of the keel line (radians about Y). */
  readonly heading: number;
  /** Heel on the bilge (radians, signed). */
  readonly heel: number;
  /** Length of the hull (m). */
  readonly length: number;
  /** Which wreck lies here (index into the renderer's models, taken modulo their number). */
  readonly variant: number;
}

/** Depth a hull strands at (m below the surface): the timbers stand clear of the water. */
const STRAND_DEPTH = -0.9;
const SHARE = 0.4;
const PORT_CLEAR = 260;

export const wreckSites = (a: Archipelago): WreckSite[] => {
  const rng = createRng(hashString(`wrecks-${a.seed}`));
  const ports = portSites(a);
  const out: WreckSite[] = [];
  for (const is of a.islands) {
    // Draw every number for every island, so one island's wreck never shifts another's.
    const chance = rng.next();
    const bearing = range(rng, 0, Math.PI * 2);
    const heading = range(rng, 0, Math.PI * 2);
    const heel = range(rng, 0.14, 0.38) * (rng.next() < 0.5 ? -1 : 1);
    const length = range(rng, 28, 42);
    const variant = Math.floor(rng.next() * 4);
    if (chance > SHARE) continue;
    // March out from the land along the bearing to where the seabed first drops to the stranding depth.
    let site: { x: number; z: number; seabed: number } | null = null;
    for (let d = is.radius * 0.6; d < is.radius * 1.3 + is.shoal + 80; d += 2) {
      const x = is.x + Math.cos(bearing) * d;
      const z = is.z + Math.sin(bearing) * d;
      const h = terrainHeight(a, x, z);
      if (h <= STRAND_DEPTH && h > STRAND_DEPTH - 1.2) {
        site = { x, z, seabed: h };
        break;
      }
      if (h < STRAND_DEPTH - 1.2 && d > is.radius) break;
    }
    if (!site || ports.some((p) => Math.hypot(p.x - site.x, p.z - site.z) < PORT_CLEAR || Math.hypot(p.ax - site.x, p.az - site.z) < PORT_CLEAR)) continue;
    out.push({ ...site, heading, heel, length, variant });
  }
  return out;
};
