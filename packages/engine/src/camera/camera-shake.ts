/**
 * Camera shake from trauma (Squirrel Eiserloh, "Math for Game Programmers: Juicing Your Cameras
 * With Math", GDC 2016): events add trauma (0..1), trauma decays linearly, and the shake is
 * trauma² (small knocks barely move the view, a magazine going up throws it about). The offset is
 * smooth noise, here a sum of three sines at incommensurate frequencies per axis (a cheap
 * stand-in for the talk's Perlin noise, deterministic for screenshots), not random jitter.
 * We shake the view sideways and up only (the renderer applies it as the camera's screen
 * offset), never the orbit, so the camera's own state is untouched when the shake ends.
 */
export class CameraShake {
  private trauma = 0;
  private t = 0;
  /** Off in the options: events still arrive, the view stays still. */
  enabled = true;

  /** Trauma per second lost. */
  static readonly DECAY = 1.4;

  add(amount: number): void {
    this.trauma = Math.min(1, this.trauma + Math.max(0, amount));
  }

  get level(): number {
    return this.trauma;
  }

  /** Advances by `dt` and returns the offset in units of the full shake, each axis within ±1. */
  step(dt: number): { x: number; y: number } {
    this.t += dt;
    this.trauma = Math.max(0, this.trauma - CameraShake.DECAY * dt);
    if (!this.enabled || this.trauma <= 0) return { x: 0, y: 0 };
    const s = this.trauma * this.trauma;
    const t = this.t;
    return {
      x: s * (0.5 * Math.sin(t * 31) + 0.3 * Math.sin(t * 47 + 1.3) + 0.2 * Math.sin(t * 73 + 2.1)),
      y: s * (0.5 * Math.sin(t * 37 + 0.7) + 0.3 * Math.sin(t * 53 + 2.9) + 0.2 * Math.sin(t * 67 + 0.4)),
    };
  }
}
