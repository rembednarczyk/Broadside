import { DAMAGE_STATES, type DomainEvent, windVector, rotate, rotateInv, vec3, waterHeight, waterVerticalSpeed } from "@broadside/core";
import { type Simulation, hullShare, pointVelocity, smokeRadius } from "@broadside/sim";
import { Color3, Matrix, type Mesh, MeshBuilder, type Scene, StandardMaterial, type Texture, Vector3 } from "../babylon";
import { BurstEmitter, rgba } from "./burst-emitter";
import { type Sprites, createSprites } from "./sprite-textures";
import { FlashLights } from "./flash-lights";
import { hullSlaps } from "./hull-slap";
import { PlankDebris } from "./plank-debris";
import type { ParticleClock } from "./particle-clock";
import type { ParticleLight } from "./particle-light";

/**
 * Turns domain events into particles (Observer: the director reacts, the simulation does not
 * know it), and draws the continuous things of a fight: shot in flight, fires aboard, men in the
 * water, barrels and mines. Shot and floaters are thin instances of one mesh each (Flyweight).
 */
export class EffectsDirector {
  readonly sprites: Sprites;
  /** How hard the sea has lately struck each ship's sides (decays over about a second): the ocean whitens the waterline with it. */
  readonly slap = new Map<number, number>();
  private readonly smoke: BurstEmitter;
  private readonly flash: BurstEmitter;
  private readonly spray: BurstEmitter;
  /** Fine spray torn off the bow wave (many small, short-lived droplets; the big puffs are for shot splashes). */
  private readonly mist: BurstEmitter;
  /** Visual length of a ship's hull (a modelled hull is longer than the physics hull); set by the renderer. */
  hullLength: (classId: string, physical: number) => number = (_id, physical) => physical;
  private readonly splinters: BurstEmitter;
  private readonly shreds: BurstEmitter;
  /** Planks torn out by shot (M11): flying, then afloat. */
  private readonly planks: PlankDebris;
  /** The planking a ship's torn planks show (set by the renderer: the hull model's own, or the generated hulls'). */
  plankTexture: (shipId: number) => Texture | null = () => null;
  /** Where each ship was last frame (planks fly out from her centre through the hit). */
  private readonly shipAt = new Map<number, { x: number; z: number }>();
  private readonly flames: BurstEmitter;
  private readonly fireSmoke: BurstEmitter;
  private readonly embers: BurstEmitter;
  private readonly screen: BurstEmitter;
  private readonly lights: FlashLights;
  private readonly shotMesh: Mesh;
  private readonly swimmers: Mesh;
  private readonly barrels: Mesh;
  private fireClock = 0;

  constructor(scene: Scene, clock: ParticleClock, particles = 1) {
    const cap = (n: number): number => Math.max(100, Math.round(n * particles));
    this.sprites = createSprites(scene);
    const g = new Vector3(0, 0, 0);
    this.smoke = new BurstEmitter("fx-smoke", scene, { texture: this.sprites.puff, capacity: cap(2500), color1: rgba(0.62, 0.61, 0.58, 0.5), color2: rgba(0.5, 0.5, 0.48, 0.42), colorDead: rgba(0.55, 0.55, 0.55, 0), minSize: 2.5, maxSize: 4.5, minLife: 6, maxLife: 11, minPower: 1, maxPower: 6, gravity: new Vector3(0, 0.4, 0), additive: false, spread: 0.35, growth: 5, drag: 0.35, quadDrag: 0.25 }, clock);
    this.flash = new BurstEmitter("fx-flash", scene, { texture: this.sprites.flare, capacity: cap(600), color1: rgba(3, 2.3, 1.3, 1), color2: rgba(2.6, 1.4, 0.45, 1), colorDead: rgba(0.6, 0.15, 0, 0), minSize: 0.7, maxSize: 1.2, minLife: 0.06, maxLife: 0.13, minPower: 12, maxPower: 30, gravity: g, additive: true, spread: 0.12, growth: 1.6, drag: 0, quadDrag: 0.08, stretch: [1.8, 3.2] }, clock);
    this.spray = new BurstEmitter("fx-spray", scene, { texture: this.sprites.puff, capacity: cap(3000), color1: rgba(0.95, 0.97, 1, 0.85), color2: rgba(0.8, 0.88, 0.92, 0.7), colorDead: rgba(0.9, 0.95, 1, 0), minSize: 1, maxSize: 1, minLife: 0.8, maxLife: 1.8, minPower: 4, maxPower: 12, gravity: new Vector3(0, -9.81, 0), additive: false, spread: 0.3, growth: 2, drag: 0.2, quadDrag: 0.04 }, clock);
    this.mist = new BurstEmitter("fx-mist", scene, { texture: this.sprites.puff, capacity: cap(5000), color1: rgba(0.93, 0.96, 1, 0.34), color2: rgba(0.82, 0.9, 0.95, 0.22), colorDead: rgba(0.9, 0.95, 1, 0), minSize: 0.22, maxSize: 0.6, minLife: 0.45, maxLife: 1.1, minPower: 2.5, maxPower: 8, gravity: new Vector3(0, -9.81, 0), additive: false, spread: 0.55, growth: 1.3, drag: 0.8, quadDrag: 0.1 }, clock);
    // Splinters: fresh-split oak, a hand's length to an arm's, thrown on along the shot's path.
    this.splinters = new BurstEmitter("fx-splinters", scene, { texture: this.sprites.shard, capacity: cap(1500), color1: rgba(0.8, 0.64, 0.44, 1), color2: rgba(0.6, 0.45, 0.3, 1), colorDead: rgba(0.5, 0.38, 0.25, 0), minSize: 0.12, maxSize: 0.3, minLife: 0.6, maxLife: 1.4, minPower: 6, maxPower: 18, gravity: new Vector3(0, -9.81, 0), additive: false, spread: 0.6, growth: 1, drag: 0, quadDrag: 0.02, stretch: [1.2, 2.6] }, clock);
    // Shreds of canvas and rope from sails and rigging: light, so the air catches them and they flutter down.
    this.shreds = new BurstEmitter("fx-shreds", scene, { texture: this.sprites.rag, capacity: cap(800), color1: rgba(0.88, 0.84, 0.74, 1), color2: rgba(0.7, 0.66, 0.56, 1), colorDead: rgba(0.7, 0.66, 0.56, 0), minSize: 0.2, maxSize: 0.45, minLife: 1.5, maxLife: 3, minPower: 4, maxPower: 10, gravity: new Vector3(0, -3, 0), additive: false, spread: 0.8, growth: 1, drag: 1.8, quadDrag: 0.1 }, clock);
    this.planks = new PlankDebris(scene, Math.max(40, Math.round(160 * particles)));
    this.flames = new BurstEmitter("fx-flames", scene, { texture: this.sprites.flare, capacity: cap(2500), color1: rgba(1, 0.7, 0.25, 0.9), color2: rgba(1, 0.4, 0.08, 0.8), colorDead: rgba(0.3, 0.05, 0, 0), minSize: 1, maxSize: 1, minLife: 0.4, maxLife: 0.9, minPower: 1, maxPower: 4, gravity: new Vector3(0, 3, 0), additive: true, spread: 0.3, growth: 0.4, drag: 0 }, clock);
    this.fireSmoke = new BurstEmitter("fx-fire-smoke", scene, { texture: this.sprites.puff, capacity: cap(2500), color1: rgba(0.15, 0.13, 0.12, 0.55), color2: rgba(0.25, 0.22, 0.2, 0.45), colorDead: rgba(0.3, 0.3, 0.3, 0), minSize: 2, maxSize: 4, minLife: 3, maxLife: 6, minPower: 2, maxPower: 5, gravity: new Vector3(0, 1.2, 0), additive: false, spread: 0.25, growth: 3.5, drag: 0.35, quadDrag: 0.05 }, clock);
    this.embers = new BurstEmitter("fx-embers", scene, { texture: this.sprites.flare, capacity: cap(1500), color1: rgba(1.6, 1.1, 0.5, 1), color2: rgba(1.4, 0.7, 0.2, 1), colorDead: rgba(0.4, 0.1, 0, 0), minSize: 0.08, maxSize: 0.16, minLife: 0.4, maxLife: 1.2, minPower: 8, maxPower: 22, gravity: new Vector3(0, -6, 0), additive: true, spread: 0.45, growth: 0.6, drag: 0, quadDrag: 0.03, stretch: [3, 6] }, clock);
    // Smoke screen: thick, slow, low-lying cloud kept topped up while the sim cloud lives.
    this.screen = new BurstEmitter("fx-screen", scene, { texture: this.sprites.puff, capacity: cap(1200), color1: rgba(0.56, 0.55, 0.53, 0.38), color2: rgba(0.46, 0.45, 0.44, 0.32), colorDead: rgba(0.5, 0.5, 0.5, 0), minSize: 14, maxSize: 26, minLife: 6, maxLife: 10, minPower: 0.3, maxPower: 1.5, gravity: new Vector3(0, 0.15, 0), additive: false, spread: 1, growth: 1.6, drag: 0.3 }, clock);
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
          this.hitDebris(e.ship, e.by, e.at, e.part, e.damage);
          break;
        case "collision":
          this.splinters.emit(e.at.x, e.at.y + 2, e.at.z, 0, 0.7, 0, Math.min(60, Math.round(e.speed * 12)), 3);
          this.tearPlanks(e.a, e.at, Math.min(6, Math.round(e.speed * 1.5)));
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
          this.tearPlanks(e.ship, e.at, 24);
          break;
        default:
          break;
      }
    }
  }

  /** The scene's light on the unlit particles (smoke, spray, splinters); fire is its own light. */
  setLight(l: ParticleLight): void {
    for (const em of [this.smoke, this.spray, this.mist, this.splinters, this.shreds, this.fireSmoke, this.screen]) em.setLight(l.r, l.g, l.b);
  }

  /** Continuous effects read from the simulation each frame. */
  frame(sim: Simulation, dt: number, burning: readonly { x: number; y: number; z: number }[] = []): void {
    this.lights.update(dt);
    this.fireClock += dt;
    const emitFires = this.fireClock > 0.08;
    if (emitFires) this.fireClock = 0;
    const w = windVector(sim.env.windDirection, sim.env.windSpeed);
    // Smoke and spray drift down the wind: drag pulls them to the wind's speed, never past it.
    // The smoke screen stays put (the simulation's cloud does not drift).
    for (const em of [this.smoke, this.fireSmoke, this.spray, this.mist, this.shreds]) em.setAir(w.x, w.z);
    for (const e of sim.ships()) {
      const s = e.ship!;
      const b = e.body!;
      this.shipAt.set(e.id, { x: b.pos.x, z: b.pos.z });
      if (!emitFires) continue;
      // Badly damaged (core damage-states): a thin dark smoke out of the wrecked timbers amidships.
      if (!s.sinking && hullShare(s) < DAMAGE_STATES.battered) this.fireSmoke.emit(b.pos.x, b.pos.y + s.model.def.hull.freeboard, b.pos.z, w.x * 0.1, 1, w.z * 0.1, 1, s.model.def.hull.length * 0.3);
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
    this.sideSpray(sim, dt);
    this.syncInstances(sim);
    const waves = sim.env.waves;
    const t = sim.env.time;
    this.planks.pool.step(dt, (x, z) => waterHeight(waves, x, z, t), (x, y, z) => this.spray.emit(x, y, z, 0, 1, 0, 3, 0.3));
    this.planks.sync();
    for (const em of [this.smoke, this.flash, this.spray, this.mist, this.splinters, this.shreds, this.flames, this.fireSmoke, this.embers, this.screen]) em.flush();
  }

  /**
   * Spray at the bow, driven by the physics. The stem cuts the sea and throws a sheet of water up
   * and out along both bows (the bow wave breaking): fine droplets from several points down the
   * forward tenth of the waterline, thrown outward and a little aft, more with speed. When the
   * stem drives down into a wave (its vertical speed against the surface) the sheet bursts higher.
   * Droplets are small and short-lived, so the sheet reads as spray, not as puffs of cloud.
   */
  private bowSpray(sim: Simulation, dt: number): void {
    const env = sim.env;
    for (const e of sim.ships()) {
      const b = e.body!;
      const s = e.ship!;
      const h = s.model.def.hull;
      const length = this.hullLength(s.model.def.id, h.length);
      const fwd = Math.max(0, rotateInv(b.rot, b.vel).z);
      if (fwd < 1.5) continue;
      const side = rotate(b.rot, vec3(1, 0, 0));
      const ahead = rotate(b.rot, vec3(0, 0, 1));
      const stem = rotate(b.rot, vec3(0, 0.3 - s.model.com.y, length * 0.47 - s.model.com.z));
      const sx0 = b.pos.x + stem.x;
      const sz0 = b.pos.z + stem.z;
      const rel = pointVelocity(b, vec3(sx0, b.pos.y + stem.y, sz0)).y - waterVerticalSpeed(env.waves, sx0, sz0, env.time);
      const slam = rel < -1 ? Math.min(3, -rel * 0.6) : 0;
      // Droplets per second from each point, growing with the square of the speed (wave-making).
      const rate = Math.min(90, fwd * fwd * 1.1) * (1 + slam * 2);
      // The wash under the counter boils up astern: a low spray off both quarters.
      const stern = rotate(b.rot, vec3(0, 0, -length * 0.5 - s.model.com.z));
      for (const sx of [-1, 1]) {
        const n = Math.floor(rate * 0.35 * dt + Math.random());
        if (n <= 0) continue;
        const x = b.pos.x + stern.x + side.x * sx * h.beam * 0.25;
        const z = b.pos.z + stern.z + side.z * sx * h.beam * 0.25;
        this.mist.emit(x, waterHeight(env.waves, x, z, env.time) + 0.1, z, side.x * sx * 0.3 - ahead.x * 0.5, 0.35, side.z * sx * 0.3 - ahead.z * 0.5, n, 0.6);
      }
      for (let k = 0; k < 4; k++) {
        // Points back along the bow: the hull widens as the sheet runs aft.
        const back = length * 0.035 * k;
        const out = h.beam * (0.06 + 0.1 * k);
        for (const sx of [-1, 1]) {
          const n = Math.floor(rate * dt * (1 - k * 0.18) + Math.random());
          if (n <= 0) continue;
          const x = sx0 - ahead.x * back + side.x * sx * out;
          const z = sz0 - ahead.z * back + side.z * sx * out;
          const y = waterHeight(env.waves, x, z, env.time) + 0.15;
          this.mist.emit(x, y, z, side.x * sx * 0.75 - ahead.x * 0.25, 0.55 + slam * 0.35, side.z * sx * 0.75 - ahead.z * 0.25, n, 0.35);
        }
      }
    }
  }

  /**
   * Spray where the sea strikes the sides (hull-slap.ts): a sheet of droplets up the planking and
   * out, more and higher the harder the meeting; the hard ones throw heavy spray as well.
   */
  private sideSpray(sim: Simulation, dt: number): void {
    const env = sim.env;
    for (const e of sim.ships()) {
      const b = e.body!;
      const s = e.ship!;
      let struck = (this.slap.get(e.id) ?? 0) * Math.exp(-dt * 1.2);
      const hull = { pos: b.pos, rot: b.rot, pointVelocity: (p: { x: number; y: number; z: number }) => pointVelocity(b, vec3(p.x, p.y, p.z)), length: this.hullLength(s.model.def.id, s.model.def.hull.length), beam: s.model.def.hull.beam, waterline: -s.model.com.y };
      for (const hit of hullSlaps(hull, env.waves, env.time)) {
        struck = Math.max(struck, Math.min(1, hit.strength / 3));
        const up = 0.9 + 0.3 * hit.strength;
        const n = Math.floor(Math.min(160, 40 + 60 * hit.strength * hit.strength) * dt + Math.random());
        if (n > 0) this.mist.emit(hit.x, hit.y + 0.1, hit.z, hit.nx * 0.5, up, hit.nz * 0.5, n, 0.9);
        if (hit.strength > 0.6) {
          const m = Math.floor(Math.min(40, 10 * hit.strength) * dt + Math.random());
          if (m > 0) this.spray.emit(hit.x, hit.y + 0.2, hit.z, hit.nx * 0.4, up * 0.8, hit.nz * 0.4, m, 0.7);
        }
      }
      this.slap.set(e.id, struck);
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

  /**
   * What a shot knocks loose, by what it struck: timber throws splinters on along the shot's path
   * (from the firing ship through the hit) and tears planks out; canvas and rope throw shreds.
   */
  private hitDebris(ship: number, by: number, at: { x: number; y: number; z: number }, part: string, damage: number): void {
    const from = this.shipAt.get(by);
    const dx = from ? at.x - from.x : 0;
    const dz = from ? at.z - from.z : 0;
    const len = Math.hypot(dx, dz) || 1;
    const n = Math.min(30, 6 + Math.round(damage));
    if (part === "sails" || part === "rigging") {
      this.shreds.emit(at.x, at.y, at.z, (dx / len) * 0.6, 0.3, (dz / len) * 0.6, Math.ceil(n / (part === "sails" ? 2 : 4)), 1);
      return;
    }
    this.splinters.emit(at.x, at.y, at.z, (dx / len) * 0.8, 0.45, (dz / len) * 0.8, n, 0.5);
    // Shot through the timbers: planks fly, more the harder the blow.
    if (part === "hull" || part === "gun" || part === "rudder") this.tearPlanks(ship, at, Math.min(6, 1 + Math.floor(damage / 6)));
    this.smoke.emit(at.x, at.y, at.z, 0, 0.3, 0, 3, 0.6);
  }

  /** Planks thrown out from a ship's side at a hit (out along the line from her centre through it). */
  private tearPlanks(ship: number, at: { x: number; y: number; z: number }, count: number): void {
    if (count <= 0) return;
    const c = this.shipAt.get(ship) ?? at;
    this.planks.pool.burst(at.x, at.y, at.z, at.x - c.x, at.z - c.z, count, this.planks.kindOf(this.plankTexture(ship)));
  }

  dispose(): void {
    this.planks.dispose();
    for (const em of [this.smoke, this.flash, this.spray, this.mist, this.splinters, this.shreds, this.flames, this.fireSmoke, this.embers, this.screen]) em.dispose();
  }
}
