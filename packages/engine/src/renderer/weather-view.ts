import { type DomainEvent } from "@broadside/core";
import { type Simulation } from "@broadside/sim";
import { Color3, Color4, type Mesh, MeshBuilder, ParticleSystem, type Scene, StandardMaterial, Vector3, type LinesMesh, type ArcRotateCamera } from "../babylon";
import { type Sprites } from "../effects/sprite-textures";

/**
 * Weather made visible: rain streaks around the camera (a particle box that follows it, the
 * standard trick for local precipitation), lightning bolts as jagged polylines with a sky flash
 * (midpoint displacement for the bolt shape), and waterspouts as tapered rotating funnels.
 */
export class WeatherView {
  private readonly rain: ParticleSystem;
  private readonly spoutMeshes = new Map<object, Mesh>();
  private readonly spoutMaterial: StandardMaterial;
  private bolt: LinesMesh | null = null;
  private boltLife = 0;
  /** 0..1 brightness of the current lightning flash, read by the renderer for the lights. */
  flash = 0;

  constructor(private readonly scene: Scene, sprites: Sprites, private readonly camera: ArcRotateCamera) {
    const rain = new ParticleSystem("rain", 6000, scene);
    rain.particleTexture = sprites.streak;
    rain.emitter = Vector3.Zero();
    rain.minEmitBox = new Vector3(-60, 40, -60);
    rain.maxEmitBox = new Vector3(60, 45, 60);
    rain.color1 = new Color4(0.75, 0.78, 0.82, 0.5);
    rain.color2 = new Color4(0.6, 0.65, 0.7, 0.35);
    rain.colorDead = new Color4(0.6, 0.65, 0.7, 0);
    rain.minSize = 0.25;
    rain.maxSize = 0.45;
    rain.minScaleY = 4;
    rain.maxScaleY = 7;
    rain.minLifeTime = 1.2;
    rain.maxLifeTime = 1.6;
    rain.direction1 = new Vector3(0, -1, 0);
    rain.direction2 = new Vector3(0, -1, 0);
    rain.minEmitPower = 30;
    rain.maxEmitPower = 36;
    rain.emitRate = 0;
    rain.billboardMode = ParticleSystem.BILLBOARDMODE_STRETCHED;
    rain.updateSpeed = 1 / 60;
    rain.start();
    this.rain = rain;
    const m = new StandardMaterial("spout", scene);
    m.diffuseColor = new Color3(0.55, 0.58, 0.6);
    m.emissiveColor = new Color3(0.18, 0.19, 0.2);
    m.alpha = 0.42;
    m.backFaceCulling = false;
    this.spoutMaterial = m;
  }

  onEvents(events: readonly DomainEvent[]): void {
    for (const e of events) if (e.type === "lightning") this.strike(e.at.x, e.at.z);
  }

  private strike(x: number, z: number): void {
    this.bolt?.dispose();
    const pts: Vector3[] = [new Vector3(x + 40, 420, z - 30), new Vector3(x, 0, z)];
    // Midpoint displacement: split each segment and push the midpoint sideways.
    for (let level = 0; level < 6; level++) {
      const next: Vector3[] = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i]!;
        const b = pts[i + 1]!;
        const off = Vector3.Distance(a, b) * 0.18;
        next.push(a, new Vector3((a.x + b.x) / 2 + (Math.random() - 0.5) * off, (a.y + b.y) / 2, (a.z + b.z) / 2 + (Math.random() - 0.5) * off));
      }
      next.push(pts[pts.length - 1]!);
      pts.splice(0, pts.length, ...next);
    }
    this.bolt = MeshBuilder.CreateLines("bolt", { points: pts }, this.scene);
    this.bolt.color = new Color3(3, 3, 3.4);
    this.bolt.applyFog = false;
    this.boltLife = 0.25;
    this.flash = 1;
  }

  frame(sim: Simulation, dt: number): void {
    const w = sim.env.weather;
    const rainAmount = w?.rain ?? 0;
    this.rain.emitRate = rainAmount * 5000;
    const t = this.camera.target;
    (this.rain.emitter as Vector3).set(t.x, t.y, t.z);
    const wx = Math.sin(sim.env.windDirection) * sim.env.windSpeed;
    const wz = Math.cos(sim.env.windDirection) * sim.env.windSpeed;
    this.rain.direction1.set(wx * 0.04, -1, wz * 0.04);
    this.rain.direction2.set(wx * 0.05, -1, wz * 0.05);
    this.flash = Math.max(0, this.flash - dt * 1.6);
    if (this.boltLife > 0) {
      this.boltLife -= dt;
      if (this.boltLife <= 0) {
        this.bolt?.dispose();
        this.bolt = null;
      }
    }
    this.syncSpouts(sim, dt);
  }

  private syncSpouts(sim: Simulation, dt: number): void {
    const seen = new Set<object>();
    for (const e of sim.world.with("spout")) {
      const sp = e.spout;
      seen.add(sp);
      let mesh = this.spoutMeshes.get(sp);
      if (!mesh) {
        mesh = MeshBuilder.CreateCylinder("spout", { height: 320, diameterBottom: sp.radius * 1.2, diameterTop: sp.radius * 6, tessellation: 18, subdivisions: 8 }, this.scene);
        mesh.material = this.spoutMaterial;
        this.spoutMeshes.set(sp, mesh);
      }
      // Grows in, fades out, sways and spins.
      const life = Math.min(1, sp.age / 8, (sp.life - sp.age) / 8);
      mesh.scaling.set(life, 1, life);
      mesh.position.set(sp.x + Math.sin(sp.age * 0.4) * 6, 160, sp.z + Math.cos(sp.age * 0.3) * 6);
      mesh.rotation.y += dt * 2.5;
    }
    for (const [sp, mesh] of this.spoutMeshes) {
      if (!seen.has(sp)) {
        mesh.dispose();
        this.spoutMeshes.delete(sp);
      }
    }
  }
}
