import { Color3, PointLight, type Scene, Vector3 } from "../babylon";

/**
 * Muzzle-flash and explosion lights: a small pool of point lights reused round-robin (Object
 * Pool, "Game Programming Patterns" ch. 19), each a short exponential decay. A broadside lights
 * its own hull and sails for a moment, the way gunfire lights a ship at dusk. The last light of the
 * pool is kept for a fire burning aboard (or in a fort's breach): a steady orange glow flickering
 * with a sum of incommensurate sines (the cheap flame flicker of games: no repeat the eye can catch),
 * fading out a quarter second after the last fire is reported.
 */
const POOL = 4;
/** Seconds a fire's glow lasts after it was last reported. */
const GLOW_LIFE = 0.25;

/** Flame flicker 0.55..1: three sines at incommensurate rates (pure: tested). */
export const flicker = (t: number): number => 0.775 + 0.1 * Math.sin(t * 13.1) + 0.075 * Math.sin(t * 7.3 + 1.7) + 0.05 * Math.sin(t * 23.9 + 0.4);

interface Flash {
  readonly light: PointLight;
  life: number;
  peak: number;
}

export class FlashLights {
  private readonly pool: Flash[] = [];
  private next = 0;

  constructor(scene: Scene) {
    for (let i = 0; i < POOL; i++) {
      const light = new PointLight(`flash-${i}`, Vector3.Zero(), scene);
      light.diffuse = new Color3(1, 0.65, 0.3);
      light.specular = new Color3(0.4, 0.3, 0.2);
      light.range = 40;
      light.intensity = 0;
      this.pool.push({ light, life: 0, peak: 0 });
    }
  }

  /** A fire to light this frame (the largest one the director sees); `strength` 1 for a ship's section ablaze. */
  glow(x: number, y: number, z: number, strength: number): void {
    const f = this.pool[POOL - 1]!;
    f.light.position.set(x, y + 2, z);
    f.light.range = 30 + strength * 10;
    f.peak = strength;
    f.life = GLOW_LIFE;
  }

  fire(x: number, y: number, z: number, strength: number): void {
    const f = this.pool[this.next]!;
    this.next = (this.next + 1) % (POOL - 1);
    f.light.position.set(x, y, z);
    f.life = 0.18;
    f.peak = strength;
    f.light.range = 25 + strength * 15;
  }

  update(dt: number): void {
    this.time += dt;
    this.pool.forEach((f, i) => {
      if (f.life <= 0) {
        f.light.intensity = 0;
        return;
      }
      f.life -= dt;
      if (i === POOL - 1) f.light.intensity = f.peak * Math.min(1, f.life / GLOW_LIFE * 4) * 1.6 * flicker(this.time);
      else f.light.intensity = f.peak * Math.max(0, f.life / 0.18) ** 2 * 6;
    });
  }

  private time = 0;
}
