import { type DomainEvent, windVector, rotate, rotateInv, vec3, waterHeight, waterVerticalSpeed } from "@broadside/core";
import { type Simulation, pointVelocity, smokeRadius } from "@broadside/sim";
import { Color3, Matrix, type Mesh, MeshBuilder, type Scene, StandardMaterial, Vector3 } from "../babylon";
import { BurstEmitter, rgba } from "./burst-emitter";
import { type Sprites, createSprites } from "./sprite-textures";
import { FlashLights } from "./flash-lights";

/**
 * Turns domain events into particles (Observer: the director reacts, the simulation does not
 * know it), and draws the continuous things of a fight: shot in flight, fires aboard, men in the
 * water, barrels and mines. Shot and floaters are thin instances of one mesh each (Flyweight).
 */
export class EffectsDirector {
  readonly sprites: Sprites;
  private readonly smoke: BurstEmitter;
  private readonly flash: BurstEmitter;
  private readonly spray: BurstEmitter;
  private readonly splinters: BurstEmitter;
  private readonly flames: BurstEmitter;
  private readonly fireSmoke: BurstEmitter;
  private readonly embers: BurstEmitter;
  private readonly screen: BurstEmitter;
  private readonly lights: FlashLights;
  private readonly shotMesh: Mesh;
  private readonly swimmers: Mesh;
  private readonly barrels: Mesh;
  private fireClock = 0;

  constructor(scene: Scene, particles = 1) {
    const cap = (n: number): number => Math.max(100, Math.round(n * particles));
    this.sprites = createSprites(scene);
    const g = new Vector3(0, 0, 0);
    this.smoke = new BurstEmitter("fx-smoke", scene, { texture: this.sprites.puff, capacity: cap(2500), color1: rgba(0.62, 0.61, 0.58, 0.5), color2: rgba(0.5, 0.5, 0.48, 0.42), colorDead: rgba(0.55, 0.55, 0.55, 0), minSize: 2.5, maxSize: 4.5, minLife: 6, maxLife: 11, minPower: 1, maxPower: 6, gravity: new Vector3(0, 0.25, 0), additive: false, spread: 0.35, growth: 5, drag: 0.08 });
    this.flash = new BurstEmitter("fx-flash", scene, { texture: this.sprites.flare, capacity: cap(600), color1: rgba(1, 0.85, 0.5, 1), color2: rgba(1, 0.55, 0.15, 1), colorDead: rgba(0.4, 0.1, 0, 0), minSize: 1, maxSize: 1, minLife: 0.08, maxLife: 0.2, minPower: 4, maxPower: 14, gravity: g, additive: true, spread: 0.15, growth: 1.8, drag: 0 });
    this.spray = new BurstEmitter("fx-spray", scene, { texture: this.sprites.puff, capacity: cap(3000), color1: rgba(0.95, 0.97, 1, 0.85), color2: rgba(0.8, 0.88, 0.92, 0.7), colorDead: rgba(0.9, 0.95, 1, 0), minSize: 1, maxSize: 1, minLife: 0.8, maxLife: 1.8, minPower: 4, maxPower: 12, gravity: new Vector3(0, -9.81, 0), additive: false, spread: 0.3, growth: 2, drag: 0 });
    this.splinters = new BurstEmitter("fx-splinters", scene, { texture: this.sprites.streak, capacity: cap(1500), color1: rgba(0.55, 0.4, 0.25, 1), color2: rgba(0.35, 0.25, 0.15, 1), colorDead: rgba(0.3, 0.2, 0.1, 0), minSize: 1, maxSize: 1, minLife: 0.6, maxLife: 1.4, minPower: 6, maxPower: 18, gravity: new Vector3(0, -9.81, 0), additive: false, spread: 0.8, growth: 1, drag: 0 });
    this.flames = new BurstEmitter("fx-flames", scene, { texture: this.sprites.flare, capacity: cap(2500), color1: rgba(1, 0.7, 0.25, 0.9), color2: rgba(1, 0.4, 0.08, 0.8), colorDead: rgba(0.3, 0.05, 0, 0), minSize: 1, maxSize: 1, minLife: 0.4, maxLife: 0.9, minPower: 1, maxPower: 4, gravity: new Vector3(0, 3, 0), additive: true, spread: 0.3, growth: 0.4, drag: 0 });
    this.fireSmoke = new BurstEmitter("fx-fire-smoke", scene, { texture: this.sprites.puff, capacity: cap(2500), color1: rgba(0.15, 0.13, 0.12, 0.55), color2: rgba(0.25, 0.22, 0.2, 0.45), colorDead: rgba(0.3, 0.3, 0.3, 0), minSize: 2, maxSize: 4, minLife: 3, maxLife: 6, minPower: 2, maxPower: 5, gravity: new Vector3(0, 1.5, 0), additive: false, spread: 0.25, growth: 3.5, drag: 0 });
    this.embers = new BurstEmitter("fx-embers", scene, { texture: this.sprites.flare, capacity: cap(1500), color1: rgba(1, 0.75, 0.35, 1), color2: rgba(1, 0.5, 0.15, 1), colorDead: rgba(0.4, 0.1, 0, 0), minSize: 1, maxSize: 1, minLife: 0.4, maxLife: 1.2, minPower: 8, maxPower: 22, gravity: new Vector3(0, -6, 0), additive: true, spread: 0.45, growth: 0.5, drag: 0 });
    // Smoke screen: thick, slow, low-lying cloud kept topped up while the sim cloud lives.
    this.screen = new BurstEmitter("fx-screen", scene, { texture: this.sprites.puff, capacity: cap(1200), color1: rgba(0.56, 0.55, 0.53, 0.38), color2: rgba(0.46, 0.45, 0.44, 0.32), colorDead: rgba(0.5, 0.5, 0.5, 0), minSize: 14, maxSize: 26, minLife: 6, maxLife: 10, minPower: 0.3, maxPower: 1.5, gravity: new Vector3(0, 0.15, 0), additive: false, spread: 1, growth: 1.6, drag: 0.05 });
    this.lights = new FlashLights(scene);
    this.shotMesh = MeshBuilder.CreateSphere("fx-shot", { diameter: 0.35, segments: 4 }, scene);
    const iron = new StandardMaterial("fx-iron", scene);
    iron.diffuseColor = new Color3(0.08, 0.08, 0.08);
    this.shotMesh.material = iron;
    this.swimmers = MeshBuilder.CreateSphere("fx-swimmer", { diameter: 0.5, segments: 4 }, scene);
    const skin = new StandardMaterial("fx-skin", scene);
    skin.diffuseColor = new Color3(0.75, 0.55, 0.42);
    this.swimmers.material = skin;
    this.barrels = MeshBuilder.CreateCylinder("fx-barrel", { height: 1.2, diameter: 0.9, tessellation: 10 }, scene);
    const wood = new StandardMaterial("fx-barrel-wood", scene);
    wood.diffuseColor = new Color3(0.42, 0.28, 0.15);
    this.barrels.material = wood;
    for (const m of [this.shotMesh, this.swimmers, this.barrels]) m.isPickable = false;
  }

  /** Reacts to the events of the last steps. `windX/Z` drifts the smoke. */
  onEvents(events: readonly DomainEvent[]): void {
    for (const e of events) {
      switch (e.type) {
        case "gunFired": {
          const big = Math.sqrt(e.pounder / 12);
          this.flash.emit(e.at.x, e.at.y, e.at.z, e.dir.x, e.dir.y, e.dir.z, 8, 0.3);
          // Powder smoke: a jet along the bore, then a rolling cloud that hangs and drifts.
          this.smoke.emit(e.at.x + e.dir.x * 2, e.at.y, e.at.z + e.dir.z * 2, e.dir.x, e.dir.y + 0.1, e.dir.z, Math.round(9 * big), 1.2);
          this.smoke.emit(e.at.x + e.dir.x * 8, e.at.y + 1, e.at.z + e.dir.z * 8, e.dir.x * 0.3, 0.2, e.dir.z * 0.3, Math.round(6 * big), 5);
          this.embers.emit(e.at.x, e.at.y, e.at.z, e.dir.x, e.dir.y + 0.15, e.dir.z, Math.round(6 * big), 0.3);
          // The blast flattens the water under the muzzle: a ring of spray.
          this.spray.emit(e.at.x + e.dir.x * 4, e.at.y - 1.5, e.at.z + e.dir.z * 4, e.dir.x * 0.5, 0.4, e.dir.z * 0.5, Math.round(5 * big), 2.5);
          this.lights.fire(e.at.x + e.dir.x * 2, e.at.y + 1, e.at.z + e.dir.z * 2, big);
          break;
        }
        case "splash":
          this.spray.emit(e.at.x, e.at.y, e.at.z, 0, 1, 0, Math.round(14 * e.size), 0.8);
          break;
        case "ricochet":
          this.spray.emit(e.at.x, e.at.y, e.at.z, 0, 0.8, 0, 6, 0.4);
          break;
        case "hit":
          this.splinters.emit(e.at.x, e.at.y, e.at.z, 0, 0.6, 0, Math.min(30, 6 + Math.round(e.damage)), 0.8);
          this.smoke.emit(e.at.x, e.at.y, e.at.z, 0, 0.3, 0, 3, 0.6);
          break;
        case "collision":
          this.splinters.emit(e.at.x, e.at.y + 2, e.at.z, 0, 0.7, 0, Math.min(60, Math.round(e.speed * 12)), 3);
          this.spray.emit(e.at.x, e.at.y, e.at.z, 0, 1, 0, Math.min(40, Math.round(e.speed * 8)), 3);
          break;
        case "explosion":
          this.lights.fire(e.at.x, e.at.y + 2, e.at.z, 2);
          this.embers.emit(e.at.x, e.at.y + 1, e.at.z, 0, 1, 0, 30, e.radius * 0.3);
          this.flash.emit(e.at.x, e.at.y + 1, e.at.z, 0, 1, 0, 30, e.radius * 0.3);
          this.spray.emit(e.at.x, e.at.y, e.at.z, 0, 1, 0, 40, e.radius * 0.4);
          this.fireSmoke.emit(e.at.x, e.at.y + 2, e.at.z, 0, 1, 0, 14, e.radius * 0.4);
          break;
        case "magazineExploded":
          this.lights.fire(e.at.x, e.at.y + 4, e.at.z, 5);
          this.embers.emit(e.at.x, e.at.y + 3, e.at.z, 0, 1, 0, 120, 4);
          this.flash.emit(e.at.x, e.at.y + 3, e.at.z, 0, 1, 0, 120, 6);
          this.fireSmoke.emit(e.at.x, e.at.y + 5, e.at.z, 0, 1, 0, 60, 8);
          this.splinters.emit(e.at.x, e.at.y + 2, e.at.z, 0, 1, 0, 120, 4);
          break;
        default:
          break;
      }
    }
  }

  /** Continuous effects read from the simulation each frame. */
  frame(sim: Simulation, dt: number, burning: readonly { x: number; y: number; z: number }[] = []): void {
    this.lights.update(dt);
    this.fireClock += dt;
    const emitFires = this.fireClock > 0.08;
    if (emitFires) this.fireClock = 0;
    const w = windVector(sim.env.windDirection, sim.env.windSpeed);
    // Powder and fire smoke drift down the wind (an acceleration towards the wind's speed).
    this.smoke.setDrift(w.x * 0.12, 0.25, w.z * 0.12);
    this.fireSmoke.setDrift(w.x * 0.15, 1.5, w.z * 0.15);
    for (const e of sim.ships()) {
      const s = e.ship!;
      const b = e.body!;
      if (!emitFires) continue;
      s.sections.forEach((sec, i) => {
        if (sec.fire <= 0) return;
        const zone = Math.floor(i / 2);
        const h = s.model.def.hull;
        const local = vec3((i % 2 === 1 ? 1 : -1) * h.beam * 0.25, h.freeboard + 1 - s.model.com.y, h.length * (0.3 - zone * 0.3));
        const p = rotate(b.rot, local);
        const n = Math.ceil(sec.fire * 4);
        this.flames.emit(b.pos.x + p.x, b.pos.y + p.y, b.pos.z + p.z, w.x * 0.05, 1, w.z * 0.05, n, 2);
        this.fireSmoke.emit(b.pos.x + p.x, b.pos.y + p.y + 2, b.pos.z + p.z, w.x * 0.1, 1, w.z * 0.1, Math.ceil(n / 2), 2);
      });
    }
    if (emitFires) {
      for (const p of burning) {
        this.flames.emit(p.x, p.y, p.z, w.x * 0.05, 1, w.z * 0.05, 3, 6);
        this.fireSmoke.emit(p.x, p.y + 3, p.z, w.x * 0.1, 1, w.z * 0.1, 2, 6);
      }
    }
    if (emitFires) for (const e of sim.world.with("spout")) this.spray.emit(e.spout.x, 1, e.spout.z, 0, 1.4, 0, 10, e.spout.radius);
    if (emitFires) {
      for (const e of sim.world.with("smoke")) {
        const r = smokeRadius(e.smoke.age);
        this.screen.emit(e.smoke.x, 9 + r * 0.1, e.smoke.z, 0, 0.2, 0, Math.max(1, Math.round(r / 12)), r * 0.75);
      }
    }
    this.bowSpray(sim, dt);
    this.syncInstances(sim);
    for (const em of [this.smoke, this.flash, this.spray, this.splinters, this.flames, this.fireSmoke, this.embers, this.screen]) em.flush();
  }

  /**
   * Spray at the bow, driven by the physics: when the stem drives down into a wave (its vertical
   * speed relative to the water surface below a threshold) a burst flies up and out to both sides,
   * bigger with the ship's speed; at speed a light plume streams from the cutwater all the time.
   */
  private bowSpray(sim: Simulation, dt: number): void {
    const env = sim.env;
    for (const e of sim.ships()) {
      const b = e.body!;
      const s = e.ship!;
      const h = s.model.def.hull;
      const stem = vec3(0, 0.3 - s.model.com.y, h.length * 0.48 - s.model.com.z);
      const p = rotate(b.rot, stem);
      const wx = b.pos.x + p.x;
      const wy = b.pos.y + p.y;
      const wz = b.pos.z + p.z;
      const surface = waterHeight(env.waves, wx, wz, env.time);
      if (wy - surface > 1.2) continue;
      const fwd = Math.max(0, rotateInv(b.rot, b.vel).z);
      const rel = pointVelocity(b, vec3(wx, wy, wz)).y - waterVerticalSpeed(env.waves, wx, wz, env.time);
      const side = rotate(b.rot, vec3(1, 0, 0));
      const slam = rel < -1.2 ? Math.min(40, Math.round(-rel * fwd * 2)) : 0;
      const plume = fwd > 3 && Math.random() < dt * 20 ? Math.round(fwd - 2) : 0;
      for (const sx of [-1, 1]) {
        const n = slam + plume;
        if (n > 0) this.spray.emit(wx + side.x * sx * h.beam * 0.3, surface + 0.3, wz + side.z * sx * h.beam * 0.3, side.x * sx * 0.6, 1 + slam * 0.03, side.z * sx * 0.6, n, 1.2);
      }
    }
  }

  private syncInstances(sim: Simulation): void {
    const shots: number[] = [];
    for (const e of sim.world.with("shot")) shots.push(...Matrix.Translation(e.shot.s.x, e.shot.s.y, e.shot.s.z).m);
    this.setInstances(this.shotMesh, shots);
    const swimmers: number[] = [];
    for (const e of sim.world.with("castaway")) {
      const c = e.castaway;
      for (let k = 0; k < Math.min(c.count, 12); k++) {
        const x = c.x + Math.sin(k * 2.4) * (1 + k * 0.35);
        const z = c.z + Math.cos(k * 2.4) * (1 + k * 0.35);
        swimmers.push(...Matrix.Translation(x, waterHeight(sim.env.waves, x, z, sim.env.time) + 0.1, z).m);
      }
    }
    this.setInstances(this.swimmers, swimmers);
    const barrels: number[] = [];
    for (const e of sim.world.with("floater")) {
      const f = e.floater;
      barrels.push(...Matrix.Translation(f.x, waterHeight(sim.env.waves, f.x, f.z, sim.env.time), f.z).m);
    }
    this.setInstances(this.barrels, barrels);
  }

  private setInstances(mesh: Mesh, matrices: number[]): void {
    const n = matrices.length / 16;
    mesh.isVisible = n > 0;
    if (n > 0) mesh.thinInstanceSetBuffer("matrix", new Float32Array(matrices), 16, false);
  }

  dispose(): void {
    for (const em of [this.smoke, this.flash, this.spray, this.splinters, this.flames, this.fireSmoke, this.embers, this.screen]) em.dispose();
  }
}
