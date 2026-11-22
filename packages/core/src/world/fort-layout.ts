import { type FortClassDef } from "../data/forts";
import { type FortSite } from "./shores";

/**
 * Fort layouts as wall segments and towers in fort space (origin at the fort's foot, +z towards
 * the sea): pure data from the class, so every fort of a class is built the same way. A star
 * fort is the trace italienne: bastions at the points of a star, curtain walls between.
 *
 * One source for the drawing and the simulation (as core/hull gives the buoyancy samples and the
 * hull mesh): the renderer builds the stone from it, the simulation fires each gun from its
 * embrasure and tests shot against the same walls (oriented boxes, the slab test of Kay and
 * Kajiya, "Ray Tracing Complex Scenes", 1986) and towers (vertical cylinders). Beta test 22.11:
 * before, the simulation fired every gun from one point and tested shot against one cylinder of
 * the class's radius, which neither covered the donjon nor matched the battery's rampart.
 */
export interface WallSegment {
  readonly x0: number;
  readonly z0: number;
  readonly x1: number;
  readonly z1: number;
  readonly height: number;
  readonly thickness: number;
}

export interface Tower {
  readonly x: number;
  readonly z: number;
  readonly radius: number;
  readonly height: number;
}

/** A gun in its embrasure: position on the wall top and the outward bearing it trains about. */
export interface FortGun {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly angle: number;
  /** Wall segment (or tower, `tower` true) it stands on. */
  readonly on: number;
  readonly tower: boolean;
}

export interface FortLayout {
  readonly walls: readonly WallSegment[];
  readonly towers: readonly Tower[];
  readonly guns: readonly FortGun[];
  /** Mortar beds in the court (they lob over the walls). */
  readonly mortars: readonly { readonly x: number; readonly y: number; readonly z: number }[];
}

/** Walls reach this far below the fort's foot (the foundation the renderer draws too). */
export const FOUNDATION = 4;

const star = (points: number, outer: number, inner: number): { x: number; z: number }[] =>
  Array.from({ length: points * 2 }, (_, i) => {
    const a = (i / (points * 2)) * Math.PI * 2;
    const r = i % 2 === 0 ? outer : inner;
    return { x: Math.sin(a) * r, z: Math.cos(a) * r };
  });

const ring = (pts: { x: number; z: number }[], height: number, thickness: number): WallSegment[] =>
  pts.map((p, i) => {
    const q = pts[(i + 1) % pts.length]!;
    return { x0: p.x, z0: p.z, x1: q.x, z1: q.z, height, thickness };
  });

/** Outward normal bearing of a wall (perpendicular to it, away from the fort's centre). */
export const wallNormal = (w: WallSegment): number => {
  const dx = w.x1 - w.x0;
  const dz = w.z1 - w.z0;
  const mx = (w.x0 + w.x1) / 2;
  const mz = (w.z0 + w.z1) / 2;
  // (dz, -dx) is one of the two perpendiculars; flip it to point away from the origin.
  const s = dz * mx - dx * mz >= 0 ? 1 : -1;
  return Math.atan2(dz * s, -dx * s);
};

const gunsAlong = (walls: readonly WallSegment[], count: number, y: number): FortGun[] => {
  const out: FortGun[] = [];
  const rows = Math.ceil(count / walls.length);
  for (let i = 0; i < count; i++) {
    const on = i % walls.length;
    const w = walls[on]!;
    const t = (Math.floor(i / walls.length) + 1) / (rows + 1);
    const x = w.x0 + (w.x1 - w.x0) * t;
    const z = w.z0 + (w.z1 - w.z0) * t;
    out.push({ x, y, z, angle: wallNormal(w), on, tower: false });
  }
  return out;
};

const courtMortars = (count: number, r: number, y: number, z0 = 0): FortLayout["mortars"] =>
  Array.from({ length: count }, (_, i) => {
    const a = (i / Math.max(1, count)) * Math.PI * 2 + 0.4;
    return { x: Math.sin(a) * r, y, z: z0 + Math.cos(a) * r };
  });

const cache = new Map<FortClassDef, FortLayout>();

export const fortLayout = (def: FortClassDef): FortLayout => {
  let l = cache.get(def);
  if (!l) {
    l = buildLayout(def);
    cache.set(def, l);
  }
  return l;
};

const buildLayout = (def: FortClassDef): FortLayout => {
  const r = def.radius;
  const h = def.height;
  if (def.id === "watchtower") {
    const towers = [{ x: 0, z: 0, radius: r, height: h }];
    const guns = Array.from({ length: def.guns }, (_, i) => {
      const a = (i / def.guns) * Math.PI * 2;
      return { x: Math.sin(a) * r, y: h * 0.8, z: Math.cos(a) * r, angle: a, on: 0, tower: true };
    });
    return { walls: [], towers, guns, mortars: [] };
  }
  if (def.id === "battery") {
    // A low curved rampart facing the sea, a magazine behind.
    const arc = Array.from({ length: 6 }, (_, i) => {
      const a = -0.9 + (1.8 * i) / 5;
      return { x: Math.sin(a) * r, z: Math.cos(a) * r * 0.6 };
    });
    const walls = arc.slice(0, -1).map((p, i) => ({ x0: p.x, z0: p.z, x1: arc[i + 1]!.x, z1: arc[i + 1]!.z, height: h, thickness: 4 }));
    return { walls, towers: [{ x: 0, z: -r * 0.4, radius: 5, height: h * 1.2 }], guns: gunsAlong(walls, def.guns, h + 0.5), mortars: courtMortars(def.mortars, r * 0.2, 1, -r * 0.1) };
  }
  const points = def.id === "citadel" ? 6 : 5;
  const walls = ring(star(points, r, r * 0.62), h, def.id === "citadel" ? 6 : 4.5);
  const towers = def.id === "citadel" ? [{ x: 0, z: 0, radius: r * 0.22, height: h * 2.2 }, ...star(points, r, r).filter((_, i) => i % 2 === 0).map((p) => ({ x: p.x, z: p.z, radius: 4, height: h * 1.3 }))] : [{ x: 0, z: 0, radius: r * 0.18, height: h * 1.4 }];
  const court = def.id === "citadel" ? r * 0.36 : r * 0.34;
  return { walls, towers, guns: gunsAlong(walls, def.guns, h + 0.5), mortars: courtMortars(def.mortars, court, 1) };
};

/** Bearing the works face (atan2(dx, dz), towards the sea); old saves without one face away from the origin. */
export const fortFacing = (site: FortSite): number => site.facing ?? Math.atan2(site.x, site.z);

/** Fort space to world (the renderer's root: rotation about y by the facing, then the site). */
export const fortToWorld = (site: FortSite, x: number, y: number, z: number): { x: number; y: number; z: number } => {
  const a = fortFacing(site);
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: site.x + x * c + z * s, y: site.y + y, z: site.z - x * s + z * c };
};

const toLocal = (site: FortSite, x: number, y: number, z: number): { x: number; y: number; z: number } => {
  const a = fortFacing(site);
  const c = Math.cos(a);
  const s = Math.sin(a);
  const dx = x - site.x;
  const dz = z - site.z;
  return { x: dx * c - dz * s, y: y - site.y, z: dx * s + dz * c };
};

/** Parameter interval [lo, hi] of p + t d inside lo..hi of one axis (a slab), clipped to `into`. */
const slab = (p: number, d: number, min: number, max: number, into: [number, number]): boolean => {
  if (Math.abs(d) < 1e-9) return p >= min && p <= max;
  let a = (min - p) / d;
  let b = (max - p) / d;
  if (a > b) [a, b] = [b, a];
  into[0] = Math.max(into[0], a);
  into[1] = Math.min(into[1], b);
  return into[0] <= into[1];
};

/** What a shot struck: a wall segment or a tower, and where along the step (0..1). */
export interface FortStrike {
  readonly t: number;
  readonly kind: "wall" | "tower";
  readonly index: number;
}

const hitWall = (w: WallSegment, a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number | null => {
  const ang = Math.atan2(w.x1 - w.x0, w.z1 - w.z0);
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const mx = (w.x0 + w.x1) / 2;
  const mz = (w.z0 + w.z1) / 2;
  // Into the wall's frame: u across, v along.
  const u0 = (a.x - mx) * c - (a.z - mz) * s;
  const v0 = (a.x - mx) * s + (a.z - mz) * c;
  const u1 = (b.x - mx) * c - (b.z - mz) * s;
  const v1 = (b.x - mx) * s + (b.z - mz) * c;
  const half = Math.hypot(w.x1 - w.x0, w.z1 - w.z0) / 2 + w.thickness * 0.25;
  const t: [number, number] = [0, 1];
  if (!slab(u0, u1 - u0, -w.thickness / 2, w.thickness / 2, t)) return null;
  if (!slab(v0, v1 - v0, -half, half, t)) return null;
  if (!slab(a.y, b.y - a.y, -FOUNDATION, w.height + 1, t)) return null;
  return t[0];
};

const hitTower = (tw: Tower, a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number | null => {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const fx = a.x - tw.x;
  const fz = a.z - tw.z;
  const A = dx * dx + dz * dz;
  const B = 2 * (fx * dx + fz * dz);
  const C = fx * fx + fz * fz - tw.radius * tw.radius;
  const t: [number, number] = [0, 1];
  if (A < 1e-9) {
    if (C > 0) return null;
  } else {
    const disc = B * B - 4 * A * C;
    if (disc < 0) return null;
    const q = Math.sqrt(disc);
    t[0] = Math.max(t[0], (-B - q) / (2 * A));
    t[1] = Math.min(t[1], (-B + q) / (2 * A));
    if (t[0] > t[1]) return null;
  }
  if (!slab(a.y, b.y - a.y, -FOUNDATION, tw.height + 1.4, t)) return null;
  return t[0];
};

/** The first wall or tower a step of shot from `from` to `to` (world) runs into, or null. */
export const strikeFort = (def: FortClassDef, site: FortSite, from: { x: number; y: number; z: number }, to: { x: number; y: number; z: number }): FortStrike | null => {
  // Cheap reject: both ends far outside the works.
  const reach = def.radius + 10;
  if (Math.min(Math.hypot(from.x - site.x, from.z - site.z), Math.hypot(to.x - site.x, to.z - site.z)) > reach + Math.hypot(to.x - from.x, to.z - from.z)) return null;
  const a = toLocal(site, from.x, from.y, from.z);
  const b = toLocal(site, to.x, to.y, to.z);
  const l = fortLayout(def);
  let best: FortStrike | null = null;
  l.walls.forEach((w, index) => {
    const t = hitWall(w, a, b);
    if (t !== null && (!best || t < best.t)) best = { t, kind: "wall", index };
  });
  l.towers.forEach((tw, index) => {
    const t = hitTower(tw, a, b);
    if (t !== null && (!best || t < best.t)) best = { t, kind: "tower", index };
  });
  return best;
};

/** Height of the highest work (the donjon of a citadel, the tower of a watchtower). */
export const fortTop = (def: FortClassDef): number => fortLayout(def).towers.reduce((m, t) => Math.max(m, t.height), def.height);
