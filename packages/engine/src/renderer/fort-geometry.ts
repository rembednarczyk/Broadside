import { type FortClassDef } from "@broadside/core";

/**
 * Fort layouts as wall segments and towers in fort space (origin at the fort's foot, +z towards
 * the sea): pure data from the class, so every fort of a class is built the same way. A star
 * fort is the trace italienne: bastions at the points of a star, curtain walls between.
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

export interface FortLayout {
  readonly walls: readonly WallSegment[];
  readonly towers: readonly Tower[];
  /** Gun embrasures: positions on the walls facing outwards (x, y, z, outward angle). */
  readonly guns: readonly { readonly x: number; readonly y: number; readonly z: number; readonly angle: number }[];
}

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

const gunsAlong = (walls: readonly WallSegment[], count: number, y: number): FortLayout["guns"] => {
  const out: { x: number; y: number; z: number; angle: number }[] = [];
  for (let i = 0; i < count; i++) {
    const w = walls[i % walls.length]!;
    const t = (Math.floor(i / walls.length) + 1) / (Math.ceil(count / walls.length) + 1);
    const x = w.x0 + (w.x1 - w.x0) * t;
    const z = w.z0 + (w.z1 - w.z0) * t;
    out.push({ x, y, z, angle: Math.atan2(x, z) });
  }
  return out;
};

export const fortLayout = (def: FortClassDef): FortLayout => {
  const r = def.radius;
  const h = def.height;
  if (def.id === "watchtower") {
    const towers = [{ x: 0, z: 0, radius: r, height: h }];
    return { walls: [], towers, guns: Array.from({ length: def.guns }, (_, i) => ({ x: Math.sin((i / def.guns) * Math.PI * 2) * r, y: h * 0.8, z: Math.cos((i / def.guns) * Math.PI * 2) * r, angle: (i / def.guns) * Math.PI * 2 })) };
  }
  if (def.id === "battery") {
    // A low curved rampart facing the sea, a magazine behind.
    const arc = Array.from({ length: 6 }, (_, i) => {
      const a = -0.9 + (1.8 * i) / 5;
      return { x: Math.sin(a) * r, z: Math.cos(a) * r * 0.6 };
    });
    const walls = arc.slice(0, -1).map((p, i) => ({ x0: p.x, z0: p.z, x1: arc[i + 1]!.x, z1: arc[i + 1]!.z, height: h, thickness: 4 }));
    return { walls, towers: [{ x: 0, z: -r * 0.4, radius: 5, height: h * 1.2 }], guns: gunsAlong(walls, def.guns, h + 0.5) };
  }
  const points = def.id === "citadel" ? 6 : 5;
  const walls = ring(star(points, r, r * 0.62), h, def.id === "citadel" ? 6 : 4.5);
  const towers = def.id === "citadel" ? [{ x: 0, z: 0, radius: r * 0.22, height: h * 2.2 }, ...star(points, r, r).filter((_, i) => i % 2 === 0).map((p) => ({ x: p.x, z: p.z, radius: 4, height: h * 1.3 }))] : [{ x: 0, z: 0, radius: r * 0.18, height: h * 1.4 }];
  return { walls, towers, guns: gunsAlong(walls, def.guns, h + 0.5) };
};
