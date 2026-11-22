import { createRng, hashString, pick, range } from "../math/rng";
import { type Faction } from "../data/factions";
import { type FortClassId } from "../data/forts";
import { DEEP_SEA, type Archipelago, type Island, spineAt, spineLength, terrainHeight } from "./archipelago";
import { FORT_CLASSES } from "../data/forts";
import { type FortSite } from "./fort-site";
import { naturalLand } from "./drawn-land";
import { fortLayout } from "./fort-layout";

/**
 * Places on the shores of the land (archipelago): ports with their anchorages, forts, the nearest
 * open water. A shore is found by marching from a point of a landmass's spine out along a bearing
 * to the first water (ray marching over the height field), so long islands, peninsulas and the
 * mainland get theirs as round islands do.
 */

/** Depth at an anchorage (m): a liner draws about 6.5 m, plus room to swing. */
const ANCHORAGE_DEPTH = -10;

/** Port of an island (the biggest islands get one, the mainland three), with its owner. */
export interface PortSite {
  readonly island: number;
  readonly x: number;
  readonly z: number;
  readonly faction: Faction;
  readonly name: string;
  /**
   * Anchorage: where ships lie off the port, in water deep enough for the largest hull, straight
   * out from the landing. Ships sail for it, trade alongside it, and escorts end there.
   */
  readonly ax: number;
  readonly az: number;
}

const PORT_NAMES = [
  "Port Saint-Ange", "Fort Royal", "Puerto Viejo", "Cala Negra", "Tortue", "Kingsbay", "San Lázaro", "Isla Brava", "Redwater", "Mercy Harbour",
  "Haven of Thieves", "Santa Clara", "Port Morant", "Vera Cruz", "Saint-Pierre", "Bridgetown", "Puerto Bello", "Nombre de Dios", "Fort Dauphin", "Gallows Bay",
  "Santo Tomás", "Port Louis", "Blackwater", "Cartagena Vieja",
];

/** From a point of the spine (t in -1..1) out along `bearing` (radians, x = cos, z = sin) to the first water, or null. */
export const shoreFrom = (a: Archipelago, is: Island, t: number, bearing: number): { x: number; z: number } | null => {
  const s = spineAt(is, t);
  const cos = Math.cos(bearing);
  const sin = Math.sin(bearing);
  const reach = is.radius * 1.6 + 40;
  for (let d = 0; d < reach; d += 6) {
    if (terrainHeight(a, s.x + cos * d, s.z + sin * d) < 0) return { x: s.x + cos * d, z: s.z + sin * d };
  }
  return null;
};

/**
 * Where a landmass's k-th shore of `count` is sought: a point of its spine and a bearing. On the
 * mainland only within the sea's square and towards it, the shores spread along the coast.
 */
const shoreBearing = (is: Island, half: number, rng: () => number, k: number, count: number): { t: number; bearing: number } => {
  if (is.form !== "mainland") return { t: (rng() * 2 - 1) * 0.7, bearing: rng() * Math.PI * 2 };
  const along = (-0.6 + (1.2 * (k + 0.2 + rng() * 0.6)) / count) * half;
  const seaward = Math.atan2(-is.z, -is.x);
  return { t: along / spineLength(is), bearing: seaward + (rng() * 2 - 1) * 0.5 };
};

/** Ports on beach and jungle land with a sheltered landing (three on the mainland); owners spread between factions, names never repeated. */
export const portSites = (a: Archipelago): PortSite[] => {
  const rng = createRng(hashString(`ports-${a.seed}`));
  const owners: Faction[] = ["crown", "republic", "empire", "pirates"];
  const names = [...PORT_NAMES];
  const out: PortSite[] = [];
  for (const is of a.islands) {
    const count = is.form === "mainland" ? 3 : is.kind !== "cliff" && is.radius > 120 ? 1 : 0;
    for (let k = 0; k < count; k++) {
      const { t, bearing } = shoreBearing(is, a.half, () => rng.next(), k, count);
      const name = names.splice(Math.floor(rng.next() * names.length), 1)[0] ?? `Port ${out.length + 1}`;
      const shore = shoreFrom(a, is, t, bearing);
      if (!shore) continue;
      const cos = Math.cos(bearing);
      const sin = Math.sin(bearing);
      const x = shore.x + cos * is.shoal * 0.3;
      const z = shore.z + sin * is.shoal * 0.3;
      // Walk out from the landing until the bed is deep enough for a ship of the line, then a margin.
      let d = 0;
      while (d < 700 && terrainHeight(a, x + cos * d, z + sin * d) > ANCHORAGE_DEPTH) d += 20;
      d += 40;
      out.push({ island: is.id, x, z, faction: owners[out.length % owners.length]!, name, ax: x + cos * d, az: z + sin * d });
    }
  }
  return out;
};

/**
 * Nearest point of open, deep water to (x, z): a spiral search outwards (golden-angle steps),
 * used to place ships safely whatever the seed made of the map.
 */
export const openWater = (a: Archipelago, x: number, z: number, clearance = 120): { x: number; z: number } => {
  const deep = (px: number, pz: number): boolean => [0, 1, 2, 3, 4, 5, 6, 7].every((k) => terrainHeight(a, px + Math.cos(k * 0.785) * clearance, pz + Math.sin(k * 0.785) * clearance) <= DEEP_SEA + 1);
  if (deep(x, z)) return { x, z };
  for (let i = 1; i < 2000; i++) {
    const r = 20 * Math.sqrt(i) * 3;
    const ang = i * 2.39996;
    const px = x + Math.cos(ang) * r;
    const pz = z + Math.sin(ang) * r;
    if (deep(px, pz)) return { x: px, z: pz };
  }
  return { x, z };
};

export type { FortSite } from "./fort-site";

/** Half the length of a harbour chain (m), and where it lies between the landing (0) and the anchorage (1). */
const CHAIN_HALF = 150;
const CHAIN_AT = 0.65;

/** The boom across the approach: square to the line from the landing out to the anchorage. */
export const harbourChain = (p: PortSite): NonNullable<FortSite["chain"]> => {
  const dx = p.ax - p.x;
  const dz = p.az - p.z;
  const d = Math.hypot(dx, dz) || 1;
  const cx = p.x + dx * CHAIN_AT;
  const cz = p.z + dz * CHAIN_AT;
  const ux = -dz / d;
  const uz = dx / d;
  return { x0: cx - ux * CHAIN_HALF, z0: cz - uz * CHAIN_HALF, x1: cx + ux * CHAIN_HALF, z1: cz + uz * CHAIN_HALF };
};

/** The drawn ground under a fort's footprint (its walls' and towers' feet and a ring 4 m outside): lowest, highest. */
export const fortGround = (a: Archipelago, classId: FortClassId, x: number, z: number, facing: number, dry = -Infinity): { min: number; max: number } => {
  const def = FORT_CLASSES[classId];
  const l = fortLayout(def);
  const c = Math.cos(facing);
  const sn = Math.sin(facing);
  let min = Infinity;
  let max = -Infinity;
  // False as soon as a point lies below `dry` (the search rejects a wet footprint early).
  const at = (lx: number, lz: number): boolean => {
    const y = naturalLand(a, x + lx * c + lz * sn, z - lx * sn + lz * c).y;
    min = Math.min(min, y);
    max = Math.max(max, y);
    return y >= dry;
  };
  // The ring outside the walls first: on a shore it is the first to get wet.
  for (let i = 0; i < 16; i++) if (!at(Math.sin((i / 16) * Math.PI * 2) * (def.radius + 4), Math.cos((i / 16) * Math.PI * 2) * (def.radius + 4))) return { min, max };
  for (const w of l.walls) for (let t = 0; t <= 1.001; t += 0.25) at(w.x0 + (w.x1 - w.x0) * t, w.z0 + (w.z1 - w.z0) * t);
  for (const tw of l.towers) {
    at(tw.x, tw.z);
    for (let i = 0; i < 8; i++) at(tw.x + Math.sin((i / 8) * Math.PI * 2) * tw.radius, tw.z + Math.cos((i / 8) * Math.PI * 2) * tw.radius);
  }
  return { min, max };
};

/** Ground the whole footprint must stand above (m): clear of the beach the waves wash. */
const DRY = 1;
/** Rise across the footprint a fort is happy with (m); more is paid for in distance from the shore. */
const LEVEL = 3;
/** Rise beyond which a smaller work is tried (the terrace would cut too deep). */
const MAX_RISE = 10;

/**
 * A fort's site: from a point at the water's edge inland along `bearing` (and up to 0.7 rad either
 * side), the nearest spot where the whole footprint stands on dry, level drawn ground (Vauban sited
 * his works on a level crown above the landing). The ground under it is levelled to a terrace half
 * way between its lowest and highest point (drawn-land drawnLand), so no wall hangs over a slope.
 * Beta test 22.11: before, the site was 8 m beyond the first ground 2 m up whatever the fort's size
 * (9–62 m), on the simulation's height, not the drawn cliffs: citadels stood half in the sea and
 * towers in the cliff faces. Returns null when no dry footprint is found, or none with a rise of at
 * most `maxRise` (a smaller work is tried then).
 */
const fortSite = (a: Archipelago, classId: FortClassId, x: number, z: number, bearing: number, facingTo: (px: number, pz: number) => number, maxRise = Infinity): { x: number; z: number; y: number; facing: number } | null => {
  const def = FORT_CLASSES[classId];
  let best: { x: number; z: number; y: number; facing: number; cost: number; rise: number } | null = null;
  for (const off of [0, -0.35, 0.35, -0.7, 0.7]) {
    const cos = Math.cos(bearing + off);
    const sin = Math.sin(bearing + off);
    for (let d = def.radius * 0.5; d < 420; d += 6) {
      const px = x + cos * d;
      const pz = z + sin * d;
      if (naturalLand(a, px, pz).y < DRY) continue;
      const facing = facingTo(px, pz);
      const g = fortGround(a, classId, px, pz, facing, DRY);
      if (g.min < DRY) continue;
      const cost = d + 25 * Math.max(0, g.max - g.min - LEVEL) + 15 * Math.abs(off);
      // The terrace stands half way between the lowest and highest ground: as much cut as fill.
      if (!best || cost < best.cost) best = { x: px, z: pz, y: (g.min + g.max) / 2, facing, cost, rise: g.max - g.min };
      if (g.max - g.min <= LEVEL) break;
    }
  }
  return best && best.rise <= maxRise ? { x: best.x, z: best.z, y: best.y, facing: best.facing } : null;
};

/**
 * Forts: every port gets one guarding its landing (class by owner and land: pirate havens a
 * battery, nations a star fort, the largest land a citadel), and some cliff islands carry a lone
 * watchtower or battery commanding the channels.
 */
export const fortSites = (a: Archipelago): FortSite[] => {
  const cached = siteCache.get(a);
  if (cached) return cached;
  const rng = createRng(hashString(`forts-${a.seed}`));
  const out: FortSite[] = [];
  portSites(a).forEach((p, i) => {
    const is = a.islands[p.island]!;
    const seaward = Math.atan2(p.az - p.z, p.ax - p.x);
    const classId: FortClassId = p.faction === "pirates" ? "battery" : is.radius > 220 ? "citadel" : "starFort";
    const towards = (px: number, pz: number): number => Math.atan2(p.ax - px, p.az - pz);
    const inlandBearing = seaward + Math.PI + range(rng, -0.4, 0.4);
    // A smaller work where the land has no room for the larger (a citadel needs a wide crown).
    const classes = FALLBACK[classId];
    for (const [k, cls] of classes.entries()) {
      const site = fortSite(a, cls, p.x, p.z, inlandBearing, towards, k < classes.length - 1 ? MAX_RISE : Infinity);
      if (site) {
        out.push({ ...site, classId: cls, faction: p.faction, port: i, ...(FORT_CLASSES[cls].chain ? { chain: harbourChain(p) } : {}) });
        return;
      }
    }
  });
  for (const is of a.islands.filter((i) => i.kind === "cliff" && i.form !== "mainland")) {
    const chance = rng.next();
    const t = range(rng, -0.6, 0.6);
    const bearing = rng.next() * Math.PI * 2;
    const tower = rng.next() < 0.6;
    const faction = pick(rng, ["crown", "republic", "empire", "pirates"] as const);
    if (chance >= 0.45) continue;
    const shore = shoreFrom(a, is, t, bearing);
    const seaFacing = Math.atan2(Math.cos(bearing), Math.sin(bearing));
    const site = shore && fortSite(a, tower ? "watchtower" : "battery", shore.x, shore.z, bearing + Math.PI, () => seaFacing);
    if (site) out.push({ ...site, classId: tower ? "watchtower" : "battery", faction, port: null });
  }
  siteCache.set(a, out);
  return out;
};

const FALLBACK: Readonly<Record<FortClassId, readonly FortClassId[]>> = { citadel: ["citadel", "starFort", "battery"], starFort: ["starFort", "battery"], battery: ["battery"], watchtower: ["watchtower"] };

/** Forts per archipelago (the simulation, the towns and the trees all ask). */
const siteCache = new WeakMap<Archipelago, FortSite[]>();

/** Ground kept clear of houses and trees around each fort (its glacis): the footprint plus 6 m. */
export const fortClearings = (a: Archipelago): { x: number; z: number; r: number }[] => fortSites(a).map((f) => ({ x: f.x, z: f.z, r: FORT_CLASSES[f.classId].radius + 6 }));
