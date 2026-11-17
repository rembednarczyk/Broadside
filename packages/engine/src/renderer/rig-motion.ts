/**
 * Motion of the rig under the wind (view only; the simulation keeps rigid masts):
 *
 * - Mast spring: each mast's head deflection is a damped harmonic oscillator (mass-spring-damper,
 *   integrated semi-implicitly) driven towards a static deflection proportional to the mast's load
 *   from the simulation (the cantilever: deflection grows linearly with the sail force for small
 *   loads). Gusts change the load and the mast whips and settles. The deflection is drawn along
 *   the mast as the bending curve of a cantilever (`bendShare`), so the spar bows smoothly and
 *   everything carried on it (yards, sails, tops, flag, shrouds, stays) moves with its height.
 * - Luffing: a sail starved of wind (fill low while set) shakes; a travelling wave runs from the luff
 *   to the leech, its amplitude growing towards the free edge, and a light flutter of the leech in a
 *   strong breeze (the standing behaviour of real canvas).
 * - Stays: a catenary approximated by a parabola, deep when the stay is slack and drawn straight as
 *   the mast load comes on.
 */
export interface MastBend {
  /** Head deflection (m): x to starboard, z forward, in hull space. */
  readonly dx: number;
  readonly dz: number;
  /** Height of the mast step (deck) and of the masthead above it. */
  readonly base: number;
  readonly height: number;
}

/** Head deflection per unit of mast load, as a share of the mast's height (about 2.5 degrees). */
const BEND_PER_LOAD = 0.045;
/** Natural frequency (Hz) and damping ratio of a mast with its rigging. */
const FREQ = 0.6;
const DAMPING = 0.25;

export class MastSprings {
  private readonly x: number[];
  private readonly vx: number[];
  private readonly z: number[];
  private readonly vz: number[];

  constructor(private readonly masts: readonly { readonly base: number; readonly height: number }[]) {
    this.x = masts.map(() => 0);
    this.vx = masts.map(() => 0);
    this.z = masts.map(() => 0);
    this.vz = masts.map(() => 0);
  }

  /**
   * `loads[i]`: mast load from the simulation (1 = at its limit); `lee`: -1..1 side the sails push
   * to (starboard +); `drive`: 0..1 share of the force pushing forward. Returns the bends.
   */
  update(dt: number, loads: readonly number[], lee: number, drive: number): MastBend[] {
    const w = 2 * Math.PI * FREQ;
    const h = Math.min(dt, 1 / 30);
    return this.masts.map((m, i) => {
      const load = Math.max(0, Math.min(1.6, loads[i] ?? 0));
      const tip = BEND_PER_LOAD * load * m.height;
      const tx = tip * lee * 0.8;
      const tz = tip * drive;
      // Semi-implicit Euler on x'' = w^2 (target - x) - 2 zeta w x'.
      this.vx[i] = this.vx[i]! + (w * w * (tx - this.x[i]!) - 2 * DAMPING * w * this.vx[i]!) * h;
      this.x[i] = this.x[i]! + this.vx[i]! * h;
      this.vz[i] = this.vz[i]! + (w * w * (tz - this.z[i]!) - 2 * DAMPING * w * this.vz[i]!) * h;
      this.z[i] = this.z[i]! + this.vz[i]! * h;
      return { dx: this.x[i]!, dz: this.z[i]!, base: m.base, height: m.height };
    });
  }
}

/**
 * Share of a mast's head deflection at a height y (hull space): the deflection curve of a cantilever
 * loaded at its end, w(s) = s^2 (3 - s) / 2 for s = height above the step / length (Euler-Bernoulli
 * beam theory): no deflection and no slope at the step, where the mast is held by the partners and
 * the keelson, and a smooth bow to the head. Above the head the curve is carried on along its
 * end slope (flags, trucks).
 */
export const bendShare = (bend: MastBend, y: number): number => {
  const s = Math.max(0, (y - bend.base) / bend.height);
  return s <= 1 ? (s * s * (3 - s)) / 2 : 1 + 1.5 * (s - 1);
};

/**
 * Luffing offset across a sail (along its local billow axis), for a point at u (luff 0 .. leech 1)
 * and v (foot 0 .. head 1): a wave travelling aft, growing to the leech.
 */
export const flutterOffset = (flutter: number, width: number, u: number, v: number, time: number): number =>
  flutter * width * 0.035 * Math.sin(u * Math.PI * 3 - time * 9 + v * 1.7) * u * (0.4 + 0.6 * Math.sin(Math.PI * Math.min(1, v * 1.05)));

/** Points of a stay from a to b sagging by `sag` metres at mid-span (parabola), `n` segments. */
export const sagLine = (a: readonly [number, number, number], b: readonly [number, number, number], sag: number, n = 6): [number, number, number][] => {
  const pts: [number, number, number][] = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t]);
  }
  return pts;
};
