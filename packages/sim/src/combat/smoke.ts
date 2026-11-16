import { type SimWorld } from "../world/world";

/**
 * Smoke screen: a cloud that billows out, drifts downwind and thins away. Lookouts (AI captains
 * and forts) cannot see a ship through it. The line-of-sight test is a segment against circles
 * (closest point on a segment, Ericson, "Real-Time Collision Detection", 5.1.2).
 */
export const SMOKE = {
  /** Seconds the screen lasts. */
  life: 45,
  /** Seconds to billow out to full size. */
  grow: 8,
  /** Seconds it thins away at the end. */
  fade: 10,
  /** Full radius (m). */
  radius: 70,
  /** Share of the wind speed it drifts at (it hugs the water, in the ship's lee). */
  drift: 0.25,
} as const;

export const smokeRadius = (age: number): number => {
  const grow = Math.min(1, age / SMOKE.grow);
  const fade = Math.min(1, Math.max(0, (SMOKE.life - age) / SMOKE.fade));
  return SMOKE.radius * (0.25 + 0.75 * grow) * fade;
};

export interface Screen {
  readonly x: number;
  readonly z: number;
  readonly r: number;
}

export const screens = (world: SimWorld): Screen[] => {
  const out: Screen[] = [];
  for (const e of world.with("smoke")) out.push({ x: e.smoke.x, z: e.smoke.z, r: smokeRadius(e.smoke.age) });
  return out;
};

/** True when smoke lies across the line from a to b (or either end sits inside a cloud). */
export const smokeBetween = (list: readonly Screen[], ax: number, az: number, bx: number, bz: number): boolean => {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz;
  for (const s of list) {
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((s.x - ax) * dx + (s.z - az) * dz) / len2)) : 0;
    const cx = ax + dx * t - s.x;
    const cz = az + dz * t - s.z;
    if (cx * cx + cz * cz < s.r * s.r) return true;
  }
  return false;
};
