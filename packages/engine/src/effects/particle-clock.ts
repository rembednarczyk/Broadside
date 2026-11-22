import { ParticleSystem, type Scene } from "../babylon";

/**
 * One clock for every particle system of the scene (Game Loop, "Game Programming Patterns",
 * ch. 9: the variable render step drives the visuals, the fixed step drives the simulation).
 *
 * Babylon ages particles by `updateSpeed × scene.getAnimationRatio()`, and the ratio comes from the
 * engine's measured frame time. The renderer calls `scene.render()` without `engine.beginFrame()`,
 * so the engine never measures it: the ratio fell to `Scene.MinDeltaTime` (1 ms per frame) and the
 * particles lived at 6% of real time on a 60 fps phone. Here the ratio is pinned
 * (`useConstantAnimationDeltaTime`, 16 ms → 0.96) and each system's `updateSpeed` is set from the
 * frame's own `dt`, so one frame ages a particle by exactly `dt` seconds, whatever the device.
 * We differ from Babylon's default (engine-measured delta) because the game already owns its
 * frame time (capped at 0.1 s, frozen in the shot tools), and particles must follow it.
 */
export const ANIMATION_RATIO = 16 * (60 / 1000);

export class ParticleClock {
  /** Seconds the last tick aged the particles (read by update functions that integrate drag). */
  dt = 0;

  constructor(private readonly scene: Scene) {
    scene.useConstantAnimationDeltaTime = true;
  }

  /** Sets every particle system to age by `dt` seconds on its next update. */
  tick(dt: number): void {
    this.dt = Math.max(0, dt);
    for (const ps of this.scene.particleSystems) ps.updateSpeed = this.dt / ANIMATION_RATIO;
  }

  /**
   * Ages the particles by `dt` without drawing (the shot tools fast-forward the simulation; the
   * effects it fires must age with it). Babylon's pre-warm path skips the vertex upload and the
   * once-per-frame guard; the next real render uploads the result.
   */
  advance(dt: number): void {
    this.tick(dt);
    for (const ps of this.scene.particleSystems) {
      if (!(ps instanceof ParticleSystem)) continue;
      ps.preWarmStepOffset = ANIMATION_RATIO;
      ps.animate(true);
    }
  }
}
