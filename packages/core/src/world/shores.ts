import { createRng, hashString, pick, range } from "../math/rng";
import { type Faction } from "../data/factions";
import { type FortClassId } from "../data/forts";
import { DEEP_SEA, type Archipelago, type Island, spineAt, spineLength, terrainHeight } from "./archipelago";

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

export interface FortSite {
  readonly x: number;
  readonly z: number;
  /** Ground height the fort stands on. */
  readonly y: number;
  readonly classId: FortClassId;
  readonly faction: Faction;
  /** Port the fort guards (index into portSites), or null for a lone work. */
  readonly port: number | null;
  /** Bearing the works face (atan2(dx, dz), towards the sea). */
  readonly facing?: number;
}

/** From a point at the water's edge inland along `bearing` to ground at least 2 m up, then 8 m further. */
const inland = (a: Archipelago, x: number, z: number, bearing: number): { x: number; z: number; y: number } | null => {
  const cos = Math.cos(bearing);
  const sin = Math.sin(bearing);
  for (let d = 0; d < 400; d += 4) {
    if (terrainHeight(a, x + cos * d, z + sin * d) > 2) {
      const px = x + cos * (d + 8);
      const pz = z + sin * (d + 8);
      return { x: px, z: pz, y: Math.max(2, terrainHeight(a, px, pz)) };
    }
  }
  return null;
};

/**
 * Forts: every port gets one guarding its landing (class by owner and land: pirate havens a
 * battery, nations a star fort, the largest land a citadel), and some cliff islands carry a lone
 * watchtower or battery commanding the channels.
 */
export const fortSites = (a: Archipelago): FortSite[] => {
  const rng = createRng(hashString(`forts-${a.seed}`));
  const out: FortSite[] = [];
  portSites(a).forEach((p, i) => {
    const is = a.islands[p.island]!;
    const seaward = Math.atan2(p.az - p.z, p.ax - p.x);
    const site = inland(a, p.x, p.z, seaward + Math.PI + range(rng, -0.4, 0.4)) ?? inland(a, p.x, p.z, seaward + Math.PI);
    if (!site) return;
    const classId: FortClassId = p.faction === "pirates" ? "battery" : is.radius > 220 ? "citadel" : "starFort";
    out.push({ ...site, classId, faction: p.faction, port: i, facing: Math.atan2(p.ax - site.x, p.az - site.z) });
  });
  for (const is of a.islands.filter((i) => i.kind === "cliff" && i.form !== "mainland")) {
    const chance = rng.next();
    const t = range(rng, -0.6, 0.6);
    const bearing = rng.next() * Math.PI * 2;
    const tower = rng.next() < 0.6;
    const faction = pick(rng, ["crown", "republic", "empire", "pirates"] as const);
    if (chance >= 0.45) continue;
    const shore = shoreFrom(a, is, t, bearing);
    const site = shore && inland(a, shore.x, shore.z, bearing + Math.PI);
    if (site) out.push({ ...site, classId: tower ? "watchtower" : "battery", faction, port: null, facing: Math.atan2(Math.cos(bearing), Math.sin(bearing)) });
  }
  return out;
};
