import { Color4, type Particle, ParticleSystem, type Scene, type Texture, Vector3 } from "../babylon";
import type { ParticleClock } from "./particle-clock";

/**
 * One particle system that emits bursts at many places (Object Pool: Babylon recycles the
 * particles; the emitter replays queued spawn requests through its start functions instead of
 * creating a system per explosion).
 *
 * Drag: after Babylon's own update each particle's velocity relaxes towards the air's (the wind)
 * with rate k = drag + quadDrag·|v − w|, integrated exactly over the step, v ← w + (v − w)·e^(−k·dt)
 * (linear plus quadratic drag, as in Stokes and Newton drag; Bridson, "Fluid Simulation for
 * Computer Graphics", §1 on particles in a moving medium). Gravity stays Babylon's: down for
 * spray, up (buoyancy) for smoke, so smoke rises at about gravity / k. Babylon's own
 * `limitVelocity` damps only above a speed limit and is not used.
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
  /** Linear drag towards the air's velocity, 1/s (the time constant is 1/drag). */
  readonly drag: number;
  /** Quadratic drag, 1/m: the extra rate per m/s of speed through the air (a jet slows fast, a drifting puff slowly). */
  readonly quadDrag?: number;
  /**
   * Stretched along the velocity (Babylon's BILLBOARDMODE_STRETCHED): the sprite's length is
   * size × scale; for splinters and rags, which read by their shape in flight.
   */
  readonly stretch?: readonly [number, number];
  /** The texture is an atlas of `cells` × `cells` sprites; each particle takes one at random. */
  readonly cells?: number;
  /**
   * Height of the sea the sprite must not cut (m): a camera-facing quad reaches at most half its
   * size below its centre, so the centre is kept that far above it (no hard line where a big puff
   * meets the water; Babylon has no soft particles).
   */
  readonly floor?: number;
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
  /** The air's velocity the particles relax towards (horizontal wind). */
  private readonly air = new Vector3(0, 0, 0);

  constructor(name: string, scene: Scene, private readonly style: BurstStyle, clock: ParticleClock) {
    const ps = new ParticleSystem(name, style.capacity, scene, null, (style.cells ?? 1) > 1);
    if (style.cells && style.cells > 1) {
      ps.spriteCellWidth = style.texture.getSize().width / style.cells;
      ps.spriteCellHeight = style.texture.getSize().height / style.cells;
      ps.startSpriteCellID = 0;
      ps.endSpriteCellID = style.cells * style.cells - 1;
      ps.spriteRandomStartCell = true;
      ps.spriteCellChangeSpeed = 0;
    }
    ps.particleTexture = style.texture;
    ps.emitter = Vector3.Zero();
    ps.emitRate = 0;
    ps.manualEmitCount = 0;
    ps.color1 = style.color1.clone();
    ps.color2 = style.color2.clone();
    ps.colorDead = style.colorDead.clone();
    ps.minSize = style.minSize;
    ps.maxSize = style.maxSize;
    ps.minLifeTime = style.minLife;
    ps.maxLifeTime = style.maxLife;
    ps.minEmitPower = style.minPower;
    ps.maxEmitPower = style.maxPower;
    ps.gravity = style.gravity;
    ps.blendMode = style.additive ? ParticleSystem.BLENDMODE_ADD : ParticleSystem.BLENDMODE_STANDARD;
    if (style.stretch) {
      ps.billboardMode = ParticleSystem.BILLBOARDMODE_STRETCHED;
      ps.minScaleY = style.stretch[0];
      ps.maxScaleY = style.stretch[1];
    }
    ps.minAngularSpeed = -0.6;
    ps.maxAngularSpeed = 0.6;
    ps.updateSpeed = 1 / 60;
    // With size gradients Babylon ignores min/maxSize, so the gradient carries the start size.
    ps.addSizeGradient(0, style.minSize, style.maxSize);
    ps.addSizeGradient(1, style.minSize * style.growth, style.maxSize * style.growth);
    const quad = style.quadDrag ?? 0;
    const floor = style.floor;
    if (style.drag > 0 || quad > 0 || floor !== undefined) {
      const base = ps.updateFunction;
      ps.updateFunction = (particles: Particle[]) => {
        base(particles);
        const dt = clock.dt;
        const w = this.air;
        for (const p of particles) {
          airDrag(p.direction, w, style.drag, quad, dt);
          if (floor !== undefined) p.position.y = Math.max(p.position.y, floor + p.size * 0.5);
        }
      };
    }
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

  /** The air's velocity (the wind): particles with drag drift towards it and no faster. */
  setAir(x: number, z: number): void {
    this.air.set(x, 0, z);
  }

  /** Tints the style's colours by the light the scene gives (particle-light.ts); alpha stays. */
  setLight(r: number, g: number, b: number): void {
    const ps = this.system;
    const tint = (c: Color4, to: Color4): void => {
      to.set(c.r * r, c.g * g, c.b * b, c.a);
    };
    tint(this.style.color1, ps.color1);
    tint(this.style.color2, ps.color2);
    tint(this.style.colorDead, ps.colorDead);
  }

  dispose(): void {
    this.system.dispose();
  }
}

/**
 * One step of drag in moving air (see the class comment): `v` relaxes towards `air` with rate
 * `drag + quad·|v − air|`, integrated exactly for the step, so it never overshoots the air's speed.
 */
export const airDrag = (v: { x: number; y: number; z: number; set(x: number, y: number, z: number): unknown }, air: { x: number; y: number; z: number }, drag: number, quad: number, dt: number): void => {
  const rx = v.x - air.x;
  const ry = v.y - air.y;
  const rz = v.z - air.z;
  const f = Math.exp(-(drag + quad * Math.hypot(rx, ry, rz)) * dt);
  v.set(air.x + rx * f, air.y + ry * f, air.z + rz * f);
};

export const rgba = (r: number, g: number, b: number, a: number): Color4 => new Color4(r, g, b, a);
