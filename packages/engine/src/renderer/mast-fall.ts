/**
 * A mast shot through going by the board (M11: Black Flag's masts coming down under chain shot):
 * it topples as a rigid rod about its broken foot, θ'' = (3g / 2L)·sin θ (a uniform rod pivoting
 * at one end), from a small first lean to lying out over the side, rests there a while, then sinks
 * away. Pure (stepped by the view, tested); the view turns the mast's mesh by `angle` towards the
 * side it falls to and lowers it by `drop`.
 */
export const MAST_FALL = {
  /** First lean (rad): a mast shot through at the foot starts already going over (from upright it would hang for seconds). */
  start: 0.25,
  /** Angle at which it lies out over the side, on the water (rad from upright). */
  lie: 1.7,
  gravity: 9.81,
  /** Seconds it lies alongside, then seconds it takes to sink out of sight. */
  rest: 8,
  sink: 4,
} as const;

export class MastFall {
  angle: number = MAST_FALL.start;
  private speed = 0;
  private lying = 0;

  constructor(private readonly length: number) {}

  /** How far it has sunk (m). */
  get drop(): number {
    return Math.max(0, this.lying - MAST_FALL.rest) * (this.length / MAST_FALL.sink) * 0.15;
  }

  /** Gone under: the view hides it. */
  get gone(): boolean {
    return this.lying >= MAST_FALL.rest + MAST_FALL.sink;
  }

  step(dt: number): void {
    if (this.angle >= MAST_FALL.lie) {
      this.lying += dt;
      return;
    }
    // A few substeps: the fall quickens fast near the end.
    const n = 4;
    for (let i = 0; i < n; i++) {
      this.speed += ((1.5 * MAST_FALL.gravity) / this.length) * Math.sin(this.angle) * (dt / n);
      this.angle = Math.min(MAST_FALL.lie, this.angle + this.speed * (dt / n));
    }
  }
}
