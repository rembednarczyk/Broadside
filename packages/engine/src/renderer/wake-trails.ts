import { TRAIL_POINTS, TRAIL_SHIPS } from "../shaders/wake-trail";

/**
 * Where the ships have been (pure, tested), for wakes that follow the course actually sailed
 * instead of a straight wedge turned with the hull. A breadcrumb trail per ship (the path
 * history of particle trails, e.g. ribbon trails in Unreal's Niagara, kept on the CPU and handed
 * to the shader as a polyline): the stern's position is recorded every RECORD_EVERY seconds,
 * and the newest point always sits at the stern now, so the trail starts at the ship. Each point
 * carries its age and the speed the ship had there; the water shader (shaders/wake-trail.ts)
 * draws the wake round the polyline: white water along it, Kelvin arms spreading as it ages.
 * Only the ships nearest the eye get one (a uniform budget: TRAIL_SHIPS by TRAIL_POINTS).
 */
export { TRAIL_POINTS, TRAIL_SHIPS };
/** Seconds between recorded points: 16 points cover about 24 s, the length of a wake's foam. */
export const RECORD_EVERY = 1.6;

export interface TrailShip {
  readonly id: number;
  readonly x: number;
  readonly z: number;
  /** Heading as the renderer's yaw (forward: sin, cos). */
  readonly heading: number;
  readonly speed: number;
  readonly length: number;
  readonly beam: number;
  /** Distance from the eye: the nearest ships get trails. */
  readonly d: number;
}

interface Point {
  x: number;
  z: number;
  t: number;
  speed: number;
}

export interface TrailUniforms {
  /** TRAIL_SHIPS * TRAIL_POINTS points: (x, z, age, speed), newest first. */
  readonly points: Float32Array;
  /** Per trail: (points used, beam, centre x, centre z). */
  readonly meta: Float32Array;
  /** Per trail: radius round its centre that holds the trail and its spread. */
  readonly reach: Float32Array;
  readonly count: number;
}

export class WakeTrails {
  private readonly history = new Map<number, Point[]>();
  private readonly points = new Float32Array(TRAIL_SHIPS * TRAIL_POINTS * 4);
  private readonly meta = new Float32Array(TRAIL_SHIPS * 4);
  private readonly reach = new Float32Array(TRAIL_SHIPS);

  /** Records the sterns at simulation `time` and returns the trails of the nearest ships. */
  update(ships: readonly TrailShip[], time: number): TrailUniforms {
    const seen = new Set<number>();
    for (const s of ships) {
      seen.add(s.id);
      const stern = { x: s.x - Math.sin(s.heading) * s.length * 0.5, z: s.z - Math.cos(s.heading) * s.length * 0.5 };
      let h = this.history.get(s.id);
      // A ship that jumped (a new game, a teleport) starts a fresh trail.
      if (h && h.length > 0 && (time < h[0]!.t || Math.hypot(stern.x - h[0]!.x, stern.z - h[0]!.z) > 60)) h = undefined;
      if (!h) {
        h = [];
        this.history.set(s.id, h);
      }
      if (h.length === 0 || time - h[0]!.t >= RECORD_EVERY) {
        h.unshift({ x: stern.x, z: stern.z, t: time, speed: s.speed });
        if (h.length > TRAIL_POINTS - 1) h.length = TRAIL_POINTS - 1;
      }
    }
    for (const id of [...this.history.keys()]) if (!seen.has(id)) this.history.delete(id);
    this.points.fill(0);
    this.meta.fill(0);
    this.reach.fill(0);
    const near = [...ships].sort((a, b) => a.d - b.d).slice(0, TRAIL_SHIPS);
    near.forEach((s, k) => {
      const stern = { x: s.x - Math.sin(s.heading) * s.length * 0.5, z: s.z - Math.cos(s.heading) * s.length * 0.5 };
      // A point recorded right at the stern now would make a first segment of no length.
      const past = (this.history.get(s.id) ?? []).filter((p) => Math.hypot(p.x - stern.x, p.z - stern.z) > 0.5);
      const pts: Point[] = [{ ...stern, t: time, speed: s.speed }, ...past];
      let cx = 0;
      let cz = 0;
      pts.forEach((p, j) => {
        this.points.set([p.x, p.z, time - p.t, p.speed], (k * TRAIL_POINTS + j) * 4);
        cx += p.x / pts.length;
        cz += p.z / pts.length;
      });
      // Room for the arms, which spread at the Kelvin angle as the wake ages.
      const spread = Math.max(...pts.map((p) => (time - p.t) * p.speed * 0.354));
      this.reach[k] = Math.max(...pts.map((p) => Math.hypot(p.x - cx, p.z - cz))) + spread + s.beam + 4;
      this.meta.set([pts.length, s.beam, cx, cz], k * 4);
    });
    return { points: this.points, meta: this.meta, reach: this.reach, count: near.length };
  }
}
