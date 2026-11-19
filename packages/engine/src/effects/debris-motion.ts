import { type Quat, integrateQuat, quatFromAxisAngle, quatFromYaw, quatNormalize, vec3, yawOf } from "@broadside/core";

/**
 * Planks torn out of a hull by shot (M11; the flying timbers of Black Flag's broadsides): a pool of
 * pieces (Object Pool, "Game Programming Patterns" ch. 19) flying as free bodies under gravity and
 * tumbling at a steady spin (no collisions: they fly clear of the ship in a fraction of a second),
 * then afloat on the visible sea (core/ocean's height, the same waves the ships ride), turning to
 * lie flat and drifting to a stop, and sinking at the end of their life. View only: the
 * simulation never sees them, so they cost nothing in determinism. A burst's pieces come from a
 * small generator seeded by the hit (the same hit throws the same planks in every replay).
 */
export interface Piece {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rot: Quat;
  /** Spin (rad/s, world axes). */
  w: { x: number; y: number; z: number };
  /** Length of the plank (m); width and thickness follow from it. */
  readonly length: number;
  /** Texture of the hull it came from (the view's kind of plank). */
  readonly kind: number;
  life: number;
  afloat: boolean;
}

export const DEBRIS = {
  /** Seconds a plank lasts (the last few it sinks). */
  life: 16,
  sink: 3,
  /** Throw speed (m/s) and length (m) ranges. */
  speed: [5, 13] as const,
  length: [0.8, 2.4] as const,
  gravity: 9.81,
  /** How fast a floating plank loses its way and its spin, and turns flat (1/s). */
  drag: 0.6,
  flatten: 2.5,
} as const;

/** Park–Miller generator over a seed made from the hit's place (deterministic per hit, no Math.random). */
const lcg = (seed: number): (() => number) => {
  let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
};

export class DebrisPool {
  readonly pieces: Piece[] = [];

  constructor(private readonly capacity: number) {}

  /**
   * `count` planks thrown from (x, y, z), mostly upwards and out along (ox, oz) (away from the
   * ship's centre); the oldest give way when the pool is full.
   */
  burst(x: number, y: number, z: number, ox: number, oz: number, count: number, kind: number): void {
    const rnd = lcg(x * 73.1 + z * 19.7 + y * 3.3 + count);
    const out = Math.hypot(ox, oz) || 1;
    for (let i = 0; i < count; i++) {
      if (this.pieces.length >= this.capacity) this.pieces.shift();
      const speed = DEBRIS.speed[0] + (DEBRIS.speed[1] - DEBRIS.speed[0]) * rnd();
      const a = rnd() * Math.PI * 2;
      // Out from the side and up, with a scatter round it.
      const dx = (ox / out) * 0.7 + Math.cos(a) * 0.45;
      const dz = (oz / out) * 0.7 + Math.sin(a) * 0.45;
      const up = 0.6 + rnd() * 0.8;
      const n = Math.hypot(dx, up, dz);
      const axis = vec3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5);
      const spin = 3 + rnd() * 9;
      const al = Math.hypot(axis.x, axis.y, axis.z) || 1;
      this.pieces.push({
        x,
        y,
        z,
        vx: (dx / n) * speed,
        vy: (up / n) * speed,
        vz: (dz / n) * speed,
        rot: quatFromAxisAngle(vec3(axis.x / al, axis.y / al, axis.z / al), rnd() * Math.PI * 2),
        w: { x: (axis.x / al) * spin, y: (axis.y / al) * spin, z: (axis.z / al) * spin },
        length: DEBRIS.length[0] + (DEBRIS.length[1] - DEBRIS.length[0]) * rnd(),
        kind,
        life: DEBRIS.life * (0.8 + 0.4 * rnd()),
        afloat: false,
      });
    }
  }

  /** Advances every plank; `water(x, z)` is the sea's height there; `splash` is told where a plank strikes the water. */
  step(dt: number, water: (x: number, z: number) => number, splash?: (x: number, y: number, z: number) => void): void {
    for (const p of this.pieces) {
      p.life -= dt;
      if (!p.afloat) {
        p.vy -= DEBRIS.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        p.rot = integrateQuat(p.rot, vec3(p.w.x, p.w.y, p.w.z), dt);
        const h = water(p.x, p.z);
        if (p.y <= h && p.vy < 0) {
          p.afloat = true;
          p.y = h;
          p.vx *= 0.25;
          p.vz *= 0.25;
          p.vy = 0;
          splash?.(p.x, h, p.z);
        }
        continue;
      }
      const k = Math.exp(-DEBRIS.drag * dt);
      p.vx *= k;
      p.vz *= k;
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      p.w = { x: p.w.x * k, y: p.w.y * k, z: p.w.z * k };
      // Turned flat on the water, keeping its heading; sinking in its last seconds.
      p.rot = blend(p.rot, quatFromYaw(yawOf(p.rot)), 1 - Math.exp(-DEBRIS.flatten * dt));
      p.rot = integrateQuat(p.rot, vec3(0, p.w.y, 0), dt);
      p.y = water(p.x, p.z) + 0.04 - Math.max(0, DEBRIS.sink - p.life) * 0.25;
    }
    for (let i = this.pieces.length - 1; i >= 0; i--) if (this.pieces[i]!.life <= 0) this.pieces.splice(i, 1);
  }

  clear(): void {
    this.pieces.length = 0;
  }
}

/** Normalised linear blend of two rotations (nlerp: enough for easing towards a target). */
const blend = (a: Quat, b: Quat, t: number): Quat => {
  const d = a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;
  const s = d < 0 ? -1 : 1;
  return quatNormalize({ x: a.x + (b.x * s - a.x) * t, y: a.y + (b.y * s - a.y) * t, z: a.z + (b.z * s - a.z) * t, w: a.w + (b.w * s - a.w) * t });
};
