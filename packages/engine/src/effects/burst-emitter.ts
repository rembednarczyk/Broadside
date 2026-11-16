import { Color4, type Particle, ParticleSystem, type Scene, type Texture, Vector3 } from "../babylon";

/**
 * One particle system that emits bursts at many places (Object Pool: Babylon recycles the
 * particles; the emitter replays queued spawn requests through its start functions instead of
 * creating a system per explosion).
 */
export interface BurstStyle {
  readonly texture: Texture;
  readonly capacity: number;
  readonly color1: Color4;
  readonly color2: Color4;
  readonly colorDead: Color4;
  readonly minSize: number;
  readonly maxSize: number;
  readonly minLife: number;
  readonly maxLife: number;
  readonly minPower: number;
  readonly maxPower: number;
  readonly gravity: Vector3;
  readonly additive: boolean;
  /** Spread of the start direction around the requested one (0 = exact, 1 = any). */
  readonly spread: number;
  readonly growth: number;
  readonly drag: number;
}

interface Request {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly dx: number;
  readonly dy: number;
  readonly dz: number;
  readonly radius: number;
}

export class BurstEmitter {
  private readonly system: ParticleSystem;
  private readonly queue: Request[] = [];
  /** Requests handed to Babylon for its next update, consumed one per new particle. */
  private batch: Request[] = [];
  private cursor = 0;
  private current: Request | null = null;

  constructor(name: string, scene: Scene, style: BurstStyle) {
    const ps = new ParticleSystem(name, style.capacity, scene);
    ps.particleTexture = style.texture;
    ps.emitter = Vector3.Zero();
    ps.emitRate = 0;
    ps.manualEmitCount = 0;
    ps.color1 = style.color1;
    ps.color2 = style.color2;
    ps.colorDead = style.colorDead;
    ps.minSize = style.minSize;
    ps.maxSize = style.maxSize;
    ps.minLifeTime = style.minLife;
    ps.maxLifeTime = style.maxLife;
    ps.minEmitPower = style.minPower;
    ps.maxEmitPower = style.maxPower;
    ps.gravity = style.gravity;
    ps.blendMode = style.additive ? ParticleSystem.BLENDMODE_ADD : ParticleSystem.BLENDMODE_STANDARD;
    ps.minAngularSpeed = -0.6;
    ps.maxAngularSpeed = 0.6;
    ps.updateSpeed = 1 / 60;
    // With size gradients Babylon ignores min/maxSize, so the gradient carries the start size.
    ps.addSizeGradient(0, style.minSize, style.maxSize);
    ps.addSizeGradient(1, style.minSize * style.growth, style.maxSize * style.growth);
    if (style.drag > 0) ps.addLimitVelocityGradient(0, 40, 40);
    if (style.drag > 0) ps.limitVelocityDamping = style.drag;
    ps.startPositionFunction = (_m: unknown, pos: Vector3) => {
      // Babylon asks for a position first for each new particle: advance the cursor here.
      this.current = this.batch[this.cursor] ?? this.batch[this.batch.length - 1] ?? null;
      this.cursor++;
      const r = this.current;
      if (!r) return;
      pos.set(r.x + (Math.random() - 0.5) * r.radius, r.y + (Math.random() - 0.5) * r.radius * 0.5, r.z + (Math.random() - 0.5) * r.radius);
    };
    ps.startDirectionFunction = (_m: unknown, dir: Vector3, _p: Particle) => {
      const r = this.current;
      if (!r) return;
      const s = style.spread;
      dir.set(r.dx + (Math.random() - 0.5) * 2 * s, r.dy + (Math.random() - 0.5) * 2 * s, r.dz + (Math.random() - 0.5) * 2 * s);
    };
    ps.start();
    this.system = ps;
  }

  /** Queues a burst of `count` particles at a point along a direction. */
  emit(x: number, y: number, z: number, dx: number, dy: number, dz: number, count: number, radius = 0.5): void {
    for (let i = 0; i < count; i++) this.queue.push({ x, y, z, dx, dy, dz, radius });
  }

  /** Hands the queued requests to Babylon's next update (call once per frame). */
  flush(): void {
    if (this.queue.length === 0) return;
    this.batch = this.queue.splice(0, this.queue.length);
    this.cursor = 0;
    this.system.manualEmitCount = this.batch.length;
  }

  setColors(c1: Color4, c2: Color4): void {
    this.system.color1 = c1;
    this.system.color2 = c2;
  }

  dispose(): void {
    this.system.dispose();
  }
}

export const rgba = (r: number, g: number, b: number, a: number): Color4 => new Color4(r, g, b, a);
