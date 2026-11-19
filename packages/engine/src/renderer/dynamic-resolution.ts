/**
 * Dynamic resolution scaling (the console engines' technique: Intel's "Dynamic Resolution
 * Rendering", 2011; the frame-time feedback of most current engines): when frames come too slow,
 * fewer pixels are shaded; when there is time to spare, the resolution climbs back to the player's
 * own choice (the slider is the ceiling, never passed). A smoothed frame time (exponential moving
 * average) against two thresholds with a dead band between them, steps of 5%, and a pause after
 * each step while the new cost settles, so the scale does not hunt. Differs from the engines in
 * the target: they hold the refresh rate exactly; a phone browser gives no GPU timings, so this
 * goes by the time between frames and only steps in when the game would stutter (below about
 * 28 frames a second), leaving the picture alone on a phone that keeps up.
 */
export const DYNAMIC_RESOLUTION = {
  /** Smoothed frame time above which the scale steps down (ms; 28 frames a second). */
  slow: 1000 / 28,
  /** Below which it steps back up (ms; 42 frames a second: room for 5% more pixels). */
  fast: 1000 / 42,
  step: 0.05,
  /** Lowest share of the player's resolution it goes to. */
  floor: 0.6,
  /** Seconds after a step before the next. */
  settle: 1.5,
  /** Weight of a new frame in the average. */
  smoothing: 0.1,
} as const;

export class DynamicResolution {
  private average = 1000 / 60;
  private wait = DYNAMIC_RESOLUTION.settle;
  private current: number;

  /** `max`: the player's render scale (the ceiling). */
  constructor(private readonly max: number) {
    this.current = max;
  }

  get scale(): number {
    return this.current;
  }

  /** One frame of `dt` seconds; returns the new scale when it changes, else null. Pauses (dt over 0.25 s: a tab in the background) are not counted. */
  update(dt: number): number | null {
    if (dt <= 0 || dt > 0.25) return null;
    const d = DYNAMIC_RESOLUTION;
    this.average += (dt * 1000 - this.average) * d.smoothing;
    this.wait -= dt;
    if (this.wait > 0) return null;
    const low = this.max * d.floor;
    let next = this.current;
    if (this.average > d.slow) next = Math.max(low, this.current - d.step);
    else if (this.average < d.fast) next = Math.min(this.max, this.current + d.step);
    next = Math.round(next * 100) / 100;
    if (next === this.current) return null;
    this.current = next;
    this.wait = d.settle;
    return next;
  }
}
