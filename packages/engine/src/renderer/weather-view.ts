import { type DomainEvent, cellInfluence } from "@broadside/core";
import { RainShafts } from "./rain-shafts";
import { type Simulation } from "@broadside/sim";
import { Color3, Color4, Mesh, MeshBuilder, ParticleSystem, type Scene, StandardMaterial, Vector3, type ArcRotateCamera } from "../babylon";
import { STRIKE_LENGTH, flashCurve, lightningBolt } from "./lightning-bolt";
import { type Sprites } from "../effects/sprite-textures";

/**
 * Weather made visible: rain streaks around the camera (a particle box that follows it, the
 * standard trick for local precipitation), lightning as branched glowing channels that flicker
 * with their return strokes (lightning-bolt), and waterspouts as tapered rotating funnels.
 */
/** Share of the bank budget that drifts over a sea under broken cloud, whatever the weather's fog. */
const STRAY_BANKS = 0.06;
const smoothstep01 = (x: number): number => {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
};

export class WeatherView {
  private readonly rain: ParticleSystem;
  private readonly fogBanks: ParticleSystem;
  private readonly spoutMeshes = new Map<object, Mesh>();
  private readonly spoutMaterial: StandardMaterial;
  private readonly shafts: RainShafts;
  private bolt: Mesh | null = null;
  private strikeAge = 0;
  /** Where the last strike hit the sea, while its flash lasts (the sky lights its clouds from there). */
  strikeAt: { x: number; z: number } | null = null;
  private readonly boltMaterial: StandardMaterial;
  /** 0..1 brightness of the current lightning flash, read by the renderer for the lights. */
  flash = 0;

  constructor(private readonly scene: Scene, sprites: Sprites, private readonly camera: ArcRotateCamera, private readonly particles = 1) {
    const rain = new ParticleSystem("rain", Math.max(500, Math.round(6000 * particles)), scene);
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
    this.fogBanks = this.createFogBanks(scene, sprites, particles);
    const m = new StandardMaterial("spout", scene);
    m.diffuseColor = new Color3(0.55, 0.58, 0.6);
    m.emissiveColor = new Color3(0.18, 0.19, 0.2);
    m.alpha = 0.42;
    m.backFaceCulling = false;
    this.shafts = new RainShafts(scene);
    this.spoutMaterial = m;
    const bm = new StandardMaterial("bolt", scene);
    bm.disableLighting = true;
    bm.emissiveColor.set(3, 3.1, 3.6);
    this.boltMaterial = bm;
  }

  /**
   * Fog banks: huge soft billboards drifting with the wind in a ring around the camera, dense
   * enough to swallow a ship for a moment (reference s. 8-9). Their number follows the weather's
   * fog; standard alpha blending, lit by nothing (fog is lit by the sky colour of the scene).
   */
  private createFogBanks(scene: Scene, sprites: Sprites, particles: number): ParticleSystem {
    const fog = new ParticleSystem("fog-banks", Math.max(40, Math.round(160 * particles)), scene);
    fog.particleTexture = sprites.puff;
    fog.emitter = Vector3.Zero();
    fog.minEmitBox = new Vector3(-420, 4, -420);
    fog.maxEmitBox = new Vector3(420, 22, 420);
    fog.color1 = new Color4(0.85, 0.82, 0.76, 0.22);
    fog.color2 = new Color4(0.78, 0.76, 0.72, 0.16);
    fog.colorDead = new Color4(0.8, 0.78, 0.74, 0);
    fog.minSize = 60;
    fog.maxSize = 140;
    fog.minLifeTime = 30;
    fog.maxLifeTime = 55;
    fog.minEmitPower = 0;
    fog.maxEmitPower = 0;
    fog.emitRate = 0;
    fog.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    fog.addColorGradient(0, new Color4(0.85, 0.82, 0.76, 0));
    fog.addColorGradient(0.2, new Color4(0.85, 0.82, 0.76, 0.22));
    fog.addColorGradient(0.8, new Color4(0.85, 0.82, 0.76, 0.2));
    fog.addColorGradient(1, new Color4(0.85, 0.82, 0.76, 0));
    fog.updateSpeed = 1 / 60;
    fog.start();
    return fog;
  }

  onEvents(events: readonly DomainEvent[]): void {
    for (const e of events) if (e.type === "lightning") this.strike(e.at.x, e.at.z);
  }

  private strike(x: number, z: number): void {
    this.bolt?.dispose();
    // A branched channel from the seeded shape (lightning-bolt), drawn as glowing tubes: bright
    // enough to bloom, the main channel about a metre thick, the branches less than half that.
    const shape = lightningBolt(x, z);
    const vec = (p: readonly (readonly [number, number, number])[]): Vector3[] => p.map((q) => new Vector3(q[0], q[1], q[2]));
    const tubes = [MeshBuilder.CreateTube("bolt-channel", { path: vec(shape.channel), radius: 0.9, tessellation: 5 }, this.scene), ...shape.branches.map((b, i) => MeshBuilder.CreateTube(`bolt-branch-${i}`, { path: vec(b), radius: 0.35, tessellation: 4 }, this.scene))];
    const bolt = Mesh.MergeMeshes(tubes, true, true)!;
    bolt.name = "bolt";
    bolt.material = this.boltMaterial;
    bolt.applyFog = false;
    bolt.isPickable = false;
    this.bolt = bolt;
    this.strikeAge = 0;
    this.strikeAt = { x, z };
    this.flash = 1;
  }

  frame(sim: Simulation, dt: number): void {
    const w = sim.env.weather;
    const t0 = this.camera.target;
    // Inside a storm cell it rains whatever the weather of the open sea.
    const cell = cellInfluence(sim.env.cells, t0.x, t0.z);
    const rainAmount = Math.max(w?.rain ?? 0, cell);
    this.rain.emitRate = rainAmount * 5000 * this.particles;
    const t = this.camera.target;
    (this.rain.emitter as Vector3).set(t.x, t.y, t.z);
    const wx = Math.sin(sim.env.windDirection) * sim.env.windSpeed;
    const wz = Math.cos(sim.env.windDirection) * sim.env.windSpeed;
    this.rain.direction1.set(wx * 0.04, -1, wz * 0.04);
    this.rain.direction2.set(wx * 0.05, -1, wz * 0.05);
    // Besides the fog of the weather, a few stray banks drift over a damp sea now and then (the
    // reference's sunset with broken cloud, s. 8-9: a bank crosses and whitens the ship for a moment).
    const fogAmount = Math.max(w?.fog ?? 0, rainAmount * 0.08, STRAY_BANKS * smoothstep01((w?.overcast ?? 0) / 0.6));
    // Keep a target number of banks alive (top up a few per frame) rather than a rate: the fog
    // is there as soon as the weather says so, and thins as it clears.
    const target = Math.round(fogAmount * this.fogBanks.getCapacity());
    const missing = target - this.fogBanks.getActiveCount();
    this.fogBanks.manualEmitCount = missing > 0 ? Math.min(5, missing) : 0;
    (this.fogBanks.emitter as Vector3).set(t.x, 0, t.z);
    this.fogBanks.gravity.set(wx * 0.06, 0, wz * 0.06);
    // Lit by the sky like the scene's haze: warm at sunset, a dull grey at night (not a white glow).
    const fc = this.scene.fogColor;
    for (const g of this.fogBanks.getColorGradients() ?? []) g.color1.set(Math.min(1, fc.r * 1.15), Math.min(1, fc.g * 1.15), Math.min(1, fc.b * 1.15), g.color1.a);
    // The flash flickers with the return strokes; the channel shows only while a stroke is bright.
    if (this.strikeAt) {
      this.strikeAge += dt;
      this.flash = flashCurve(this.strikeAge);
      if (this.bolt) this.bolt.setEnabled(this.flash > 0.3);
      this.boltMaterial.emissiveColor.set(2.6 * this.flash + 0.4, 2.7 * this.flash + 0.4, 3.2 * this.flash + 0.5);
      if (this.strikeAge > STRIKE_LENGTH) {
        this.bolt?.dispose();
        this.bolt = null;
        this.strikeAt = null;
        this.flash = 0;
      }
    }
    this.syncSpouts(sim, dt);
    this.shafts.sync(sim.env.cells, this.camera.target.x, this.camera.target.z);
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
