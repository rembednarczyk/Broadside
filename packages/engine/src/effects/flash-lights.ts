import { Color3, PointLight, type Scene, Vector3 } from "../babylon";

/**
 * Muzzle-flash and explosion lights: a small pool of point lights reused round-robin (Object
 * Pool, "Game Programming Patterns" ch. 19), each a short exponential decay. A broadside lights
 * its own hull and sails for a moment, the way gunfire lights a ship at dusk.
 */
const POOL = 4;

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

  fire(x: number, y: number, z: number, strength: number): void {
    const f = this.pool[this.next]!;
    this.next = (this.next + 1) % POOL;
    f.light.position.set(x, y, z);
    f.life = 0.18;
    f.peak = strength;
    f.light.range = 25 + strength * 15;
  }

  update(dt: number): void {
    for (const f of this.pool) {
      if (f.life <= 0) {
        f.light.intensity = 0;
        continue;
      }
      f.life -= dt;
      f.light.intensity = f.peak * Math.max(0, f.life / 0.18) ** 2 * 6;
    }
  }
}
