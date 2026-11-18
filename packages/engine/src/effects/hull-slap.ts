import { type GerstnerWave, type Quat, type Vec3, rotate, vec3, waterState } from "@broadside/core";

/**
 * Where the sea strikes a hull's side (pure, tested): points along the waterline of both sides,
 * each comparing the water's motion with the hull's there (Kerner, "Water interaction model for
 * boats in video games", Gamasutra 2015: spray and slamming from the relative velocity of the
 * water at the hull). Water rising against the side, or the side rolling down into it, and water
 * running onto the side (a wave meeting the beam) both throw spray up the planking; the faster
 * the meeting, the bigger the burst. Only points where the surface is near the waterline count
 * (a side lifted clear of the sea, or deep under it, throws nothing).
 */
export interface SlapHull {
  readonly pos: Vec3;
  readonly rot: Quat;
  /** Velocity of a world point of the hull (the rigid body's). */
  readonly pointVelocity: (p: Vec3) => Vec3;
  /** Length and beam of the hull the eye sees, and the waterline's height in body space. */
  readonly length: number;
  readonly beam: number;
  readonly waterline: number;
}

export interface Slap {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Unit outward normal of the side on the water plane. */
  readonly nx: number;
  readonly nz: number;
  /** Speed of the meeting above the threshold (m/s). */
  readonly strength: number;
}

/** Below this speed of meeting (m/s) the sea laps at the side without spray. */
export const SLAP_THRESHOLD = 1.2;
/** Stations along the hull, as shares of its length from amidships (stern negative). */
const STATIONS = [-0.36, -0.18, 0, 0.18, 0.34] as const;

export const hullSlaps = (hull: SlapHull, waves: readonly GerstnerWave[], t: number): Slap[] => {
  const out: Slap[] = [];
  for (const share of STATIONS) {
    const z = share * hull.length;
    // Half-breadth at the station: an ellipse along the length, finer at the bow.
    const u = (2 * z) / hull.length;
    const half = (hull.beam / 2) * Math.sqrt(Math.max(0.05, 1 - u * u * (u > 0 ? 1.2 : 0.8)));
    for (const side of [-1, 1]) {
      const local = vec3(side * half, hull.waterline, z);
      const off = rotate(hull.rot, local);
      const p = vec3(hull.pos.x + off.x, hull.pos.y + off.y, hull.pos.z + off.z);
      const water = waterState(waves, p.x, p.z, t);
      if (Math.abs(water.height - p.y) > 1.5) continue;
      const n = rotate(hull.rot, vec3(side, 0, 0));
      const nl = Math.hypot(n.x, n.z) || 1;
      const nx = n.x / nl;
      const nz = n.z / nl;
      const hv = hull.pointVelocity(p);
      const rise = water.velocity.y - hv.y;
      const onto = -((water.velocity.x - hv.x) * nx + (water.velocity.z - hv.z) * nz);
      const strength = Math.max(0, rise) + Math.max(0, onto) * 0.7 - SLAP_THRESHOLD;
      if (strength > 0) out.push({ x: p.x, y: water.height, z: p.z, nx, nz, strength });
    }
  }
  return out;
};
