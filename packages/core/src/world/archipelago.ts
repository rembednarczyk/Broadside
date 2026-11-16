import { type Rng, createRng, hashString, pick, range } from "../math/rng";
import { fbm2, ridged2 } from "../math/noise";
import { clamp, smoothstep } from "../math/scalar";
import { type Faction } from "../data/factions";
import { type FortClassId } from "../data/forts";

/**
 * The archipelago: islands placed by Poisson-disc sampling (Bridson, "Fast Poisson Disk Sampling
 * in Arbitrary Dimensions", 2007) so they never crowd, each with a terrain height function shared
 * by the simulation (seabed, grounding) and the renderer (island meshes). Deterministic from the
 * seed: the same world every time for a save.
 */
export type IslandKind = "cliff" | "beach" | "jungle";

export interface Island {
  readonly id: number;
  readonly x: number;
  readonly z: number;
  /** Radius of the land at sea level (metres). */
  readonly radius: number;
  /** Highest point of the land. */
  readonly height: number;
  readonly kind: IslandKind;
  /** Seed of the island's own noise. */
  readonly seed: number;
  /** Width of the reef and shoal ring around the shore. */
  readonly shoal: number;
}

export interface Archipelago {
  readonly seed: number;
  /** Half size of the square sea (metres). */
  readonly half: number;
  readonly islands: readonly Island[];
}

/** Depth of open sea (metres below the surface). */
export const DEEP_SEA = -60;

const KINDS: readonly IslandKind[] = ["cliff", "cliff", "beach", "jungle"];

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

/**
 * Generates the archipelago. The start area around the origin is kept open water (the player
 * starts there).
 */
export const generateArchipelago = (seed: number, half = 4000, spacing = 900, startClear = 700): Archipelago => {
  const rng = createRng(hashString(`archipelago-${seed}`));
  // An island reaches up to 1.25 radius (wobble) plus its shoal and the slope beyond: keep
  // centres far enough for the whole reach to stay clear of the start area.
  const pts = poissonDisc(rng, half, spacing, startClear + 260 * 1.25 + 140 + 80);
  const islands = pts.map((p, id) => {
    const kind = pick(rng, KINDS);
    const radius = range(rng, 90, 260);
    const height = kind === "cliff" ? range(rng, 60, 140) : kind === "jungle" ? range(rng, 40, 110) : range(rng, 8, 25);
    return { id, x: p.x, z: p.z, radius, height, kind, seed: hashString(`island-${seed}-${id}`), shoal: kind === "beach" ? range(rng, 70, 140) : range(rng, 30, 70) };
  });
  return { seed, half, islands };
};

/**
 * Terrain height of one island at a world point (metres; negative under water). The coastline
 * wobbles with noise; cliff islands rise in a steep step to a rolling plateau (the reference's
 * flat-topped headlands), beaches slope gently, jungle islands make a rounded peak.
 */
export const islandHeight = (is: Island, x: number, z: number): number => {
  const dx = x - is.x;
  const dz = z - is.z;
  const d = Math.hypot(dx, dz);
  const reach = is.radius + is.shoal + 80;
  if (d > reach) return DEEP_SEA;
  const ang = Math.atan2(dz, dx);
  const wobble = 0.75 + 0.5 * fbm2(is.seed, Math.cos(ang) * 1.8 + 5, Math.sin(ang) * 1.8 + 5, 3);
  const r = is.radius * wobble;
  const t = d / r;
  // Under water: from the shore down over the shoal to the deep.
  const sea = DEEP_SEA + (1 - smoothstep(1, 1 + is.shoal / r, t)) * (-DEEP_SEA - 1.5);
  if (t >= 1) return sea;
  const n = fbm2(is.seed + 7, x * 0.006, z * 0.006, 4);
  // Domain warp (Quilez) bends the ridges so they wander like real spurs and gullies.
  const wx = x * 0.011 + 2.5 * fbm2(is.seed + 21, x * 0.004, z * 0.004, 2);
  const wz = z * 0.011 + 2.5 * fbm2(is.seed + 22, x * 0.004, z * 0.004, 2);
  const ridges = ridged2(is.seed + 13, wx, wz, 4);
  if (is.kind === "cliff") {
    const edge = smoothstep(1, 0.9, t);
    // Plateau with gullies cut into it.
    return -1.5 + edge * is.height * (0.72 + 0.3 * n - 0.22 * (1 - ridges));
  }
  const peak = Math.pow(clamp(1 - t, 0, 1), 1.1);
  if (is.kind === "beach") return -1.5 + (1 - t * t) * is.height * (0.45 + 0.4 * n + 0.35 * ridges * peak);
  return -1.5 + is.height * (peak * (0.35 + 0.45 * n) + 0.45 * ridges * Math.sqrt(peak));
};

/** Terrain height of the whole world at a point (the highest island there, or the deep sea). */
export const terrainHeight = (a: Archipelago, x: number, z: number): number => {
  let h = DEEP_SEA;
  for (const is of a.islands) {
    if (Math.abs(x - is.x) > is.radius * 1.3 + is.shoal + 80 || Math.abs(z - is.z) > is.radius * 1.3 + is.shoal + 80) continue;
    h = Math.max(h, islandHeight(is, x, z));
  }
  return h;
};

/** Port of an island (the biggest islands get one), with its owner. */
export interface PortSite {
  readonly island: number;
  readonly x: number;
  readonly z: number;
  readonly faction: Faction;
  readonly name: string;
}

const PORT_NAMES = ["Port Saint-Ange", "Fort Royal", "Puerto Viejo", "Cala Negra", "Tortue", "Kingsbay", "San Lázaro", "Isla Brava", "Redwater", "Mercy Harbour", "Haven of Thieves", "Santa Clara"];

/** Ports on beach and jungle islands with a sheltered landing; owners spread between factions. */
export const portSites = (a: Archipelago): PortSite[] => {
  const rng = createRng(hashString(`ports-${a.seed}`));
  const owners: Faction[] = ["crown", "republic", "empire", "pirates"];
  return a.islands
    .filter((is) => is.kind !== "cliff" && is.radius > 120)
    .map((is, i) => {
      const ang = rng.next() * Math.PI * 2;
      const r = is.radius + is.shoal * 0.4;
      return { island: is.id, x: is.x + Math.cos(ang) * r, z: is.z + Math.sin(ang) * r, faction: owners[i % owners.length]!, name: PORT_NAMES[i % PORT_NAMES.length]! };
    });
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
  /** Bearing the works face (away from the island's centre, towards the sea). */
  readonly facing?: number;
}

/** Point on an island's land at a given bearing, a little inland from the shore. */
const onShore = (a: Archipelago, is: Island, bearing: number): { x: number; z: number; y: number } => {
  let best = { x: is.x, z: is.z, y: islandHeight(is, is.x, is.z) };
  for (let r = is.radius * 1.3; r > 0; r -= 6) {
    const x = is.x + Math.cos(bearing) * r;
    const z = is.z + Math.sin(bearing) * r;
    const y = islandHeight(is, x, z);
    if (y > 2) {
      best = { x: x - Math.cos(bearing) * 8, z: z - Math.sin(bearing) * 8, y: Math.max(2, islandHeight(is, x - Math.cos(bearing) * 8, z - Math.sin(bearing) * 8)) };
      break;
    }
  }
  return best;
};

/**
 * Forts: every port gets one guarding its landing (class by owner and island size: pirate havens
 * a battery, nations a star fort, the largest a citadel), and some cliff islands carry a lone
 * watchtower or battery commanding the channels.
 */
export const fortSites = (a: Archipelago): FortSite[] => {
  const rng = createRng(hashString(`forts-${a.seed}`));
  const ports = portSites(a);
  const out: FortSite[] = ports.map((p, i) => {
    const is = a.islands[p.island]!;
    const bearing = Math.atan2(p.z - is.z, p.x - is.x) + range(rng, -0.4, 0.4);
    const site = onShore(a, is, bearing);
    const classId: FortClassId = p.faction === "pirates" ? "battery" : is.radius > 220 ? "citadel" : "starFort";
    return { ...site, classId, faction: p.faction, port: i, facing: Math.atan2(site.x - is.x, site.z - is.z) };
  });
  for (const is of a.islands.filter((i) => i.kind === "cliff")) {
    if (rng.next() < 0.45) {
      const site = onShore(a, is, rng.next() * Math.PI * 2);
      out.push({ ...site, classId: rng.next() < 0.6 ? "watchtower" : "battery", faction: pick(rng, ["crown", "republic", "empire", "pirates"] as const), port: null, facing: Math.atan2(site.x - is.x, site.z - is.z) });
    }
  }
  return out;
};
