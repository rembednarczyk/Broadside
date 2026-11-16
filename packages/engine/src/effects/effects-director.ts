import { type DomainEvent, windVector, rotate, vec3, waterHeight } from "@broadside/core";
import { type Simulation } from "@broadside/sim";
import { Color3, Matrix, type Mesh, MeshBuilder, type Scene, StandardMaterial, Vector3 } from "../babylon";
import { BurstEmitter, rgba } from "./burst-emitter";
import { type Sprites, createSprites } from "./sprite-textures";

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
  private readonly shotMesh: Mesh;
  private readonly swimmers: Mesh;
  private readonly barrels: Mesh;
  private fireClock = 0;

  constructor(scene: Scene) {
    this.sprites = createSprites(scene);
    const g = new Vector3(0, 0, 0);
    this.smoke = new BurstEmitter("fx-smoke", scene, { texture: this.sprites.puff, capacity: 3000, color1: rgba(0.86, 0.85, 0.82, 0.55), color2: rgba(0.7, 0.7, 0.68, 0.45), colorDead: rgba(0.7, 0.7, 0.7, 0), minSize: 2.5, maxSize: 4.5, minLife: 4, maxLife: 7, minPower: 1, maxPower: 6, gravity: new Vector3(0, 0.25, 0), additive: false, spread: 0.35, growth: 4, drag: 0.08 });
    this.flash = new BurstEmitter("fx-flash", scene, { texture: this.sprites.flare, capacity: 600, color1: rgba(1, 0.85, 0.5, 1), color2: rgba(1, 0.55, 0.15, 1), colorDead: rgba(0.4, 0.1, 0, 0), minSize: 1.2, maxSize: 2.6, minLife: 0.08, maxLife: 0.2, minPower: 4, maxPower: 14, gravity: g, additive: true, spread: 0.15, growth: 1.8, drag: 0 });
    this.spray = new BurstEmitter("fx-spray", scene, { texture: this.sprites.puff, capacity: 3000, color1: rgba(0.95, 0.97, 1, 0.85), color2: rgba(0.8, 0.88, 0.92, 0.7), colorDead: rgba(0.9, 0.95, 1, 0), minSize: 0.5, maxSize: 1.6, minLife: 0.8, maxLife: 1.8, minPower: 4, maxPower: 12, gravity: new Vector3(0, -9.81, 0), additive: false, spread: 0.3, growth: 2, drag: 0 });
    this.splinters = new BurstEmitter("fx-splinters", scene, { texture: this.sprites.streak, capacity: 1500, color1: rgba(0.55, 0.4, 0.25, 1), color2: rgba(0.35, 0.25, 0.15, 1), colorDead: rgba(0.3, 0.2, 0.1, 0), minSize: 0.2, maxSize: 0.6, minLife: 0.6, maxLife: 1.4, minPower: 6, maxPower: 18, gravity: new Vector3(0, -9.81, 0), additive: false, spread: 0.8, growth: 1, drag: 0 });
    this.flames = new BurstEmitter("fx-flames", scene, { texture: this.sprites.flare, capacity: 2500, color1: rgba(1, 0.7, 0.25, 0.9), color2: rgba(1, 0.4, 0.08, 0.8), colorDead: rgba(0.3, 0.05, 0, 0), minSize: 1, maxSize: 2.6, minLife: 0.4, maxLife: 0.9, minPower: 1, maxPower: 4, gravity: new Vector3(0, 3, 0), additive: true, spread: 0.3, growth: 0.4, drag: 0 });
    this.fireSmoke = new BurstEmitter("fx-fire-smoke", scene, { texture: this.sprites.puff, capacity: 2500, color1: rgba(0.15, 0.13, 0.12, 0.55), color2: rgba(0.25, 0.22, 0.2, 0.45), colorDead: rgba(0.3, 0.3, 0.3, 0), minSize: 2, maxSize: 4, minLife: 3, maxLife: 6, minPower: 2, maxPower: 5, gravity: new Vector3(0, 1.5, 0), additive: false, spread: 0.25, growth: 3.5, drag: 0 });
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
          this.flash.emit(e.at.x, e.at.y, e.at.z, e.dir.x, e.dir.y, e.dir.z, 6, 0.3);
          this.smoke.emit(e.at.x + e.dir.x * 2, e.at.y, e.at.z + e.dir.z * 2, e.dir.x, e.dir.y + 0.1, e.dir.z, Math.round(10 * big), 1.2);
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
        case "explosion":
          this.flash.emit(e.at.x, e.at.y + 1, e.at.z, 0, 1, 0, 30, e.radius * 0.3);
          this.spray.emit(e.at.x, e.at.y, e.at.z, 0, 1, 0, 40, e.radius * 0.4);
          this.fireSmoke.emit(e.at.x, e.at.y + 2, e.at.z, 0, 1, 0, 14, e.radius * 0.4);
          break;
        case "magazineExploded":
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
  frame(sim: Simulation, dt: number): void {
    this.fireClock += dt;
    const emitFires = this.fireClock > 0.08;
    if (emitFires) this.fireClock = 0;
    const w = windVector(sim.env.windDirection, sim.env.windSpeed);
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
    if (emitFires) for (const e of sim.world.with("spout")) this.spray.emit(e.spout.x, 1, e.spout.z, 0, 1.4, 0, 10, e.spout.radius);
    this.syncInstances(sim);
    for (const em of [this.smoke, this.flash, this.spray, this.splinters, this.flames, this.fireSmoke]) em.flush();
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
    for (const em of [this.smoke, this.flash, this.spray, this.splinters, this.flames, this.fireSmoke]) em.dispose();
  }
}
