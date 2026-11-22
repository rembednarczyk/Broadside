import { WakeTrails } from "./wake-trails";
import { type Simulation } from "@broadside/sim";
import { CascadedShadowGenerator, Matrix, Color3, Color4, DirectionalLight, Engine, HemisphericLight, Scene, SceneInstrumentation, ShadowGenerator, type Texture, Vector3 } from "../babylon";
import { FollowCamera } from "../camera/follow-camera";
import { PostStack } from "./post-stack";
import { type GraphicsSettings } from "../graphics-settings";
import { Ocean } from "./ocean";
import { Sky } from "./sky";
import { type SceneLook, sceneLook } from "./look";
import { type ShipMaterials, ShipView, createShipMaterials, setNightGlow } from "./ship-view";
import { SAIL_TRANSMITTANCE, sailLightOf } from "./sail-translucency";
import { ShipFill } from "./ship-fill";
import { wetSkyOf } from "./wet-deck";
import { hazeSunOf } from "./sun-haze";
import { EffectsDirector } from "../effects/effects-director";
import { ParticleClock } from "../effects/particle-clock";
import { CameraShake } from "../camera/camera-shake";
import { particleLight } from "../effects/particle-light";
import { SalvoMarks } from "./salvo-marks";
import { CourseView } from "./course-view";
import { HullModels } from "./hull-models";
import { WeatherView } from "./weather-view";
import { FarCoast } from "./far-coast";
import { IslandsView } from "./islands-view";
import { FortsView } from "./forts-view";
import { TownsView } from "./towns-view";
import { WrecksView } from "./wrecks-view";
import { CrewRig } from "./crew-rig";
import { GunScan } from "./ship-guns";
import { type DomainEvent, SHIP_CLASSES, type ShipClassId, rotateInv, shoreDistance, waterHeight, wreckSites, yawOf } from "@broadside/core";

/**
 * Facade over the Babylon scene (Facade, GoF; SpinalTap's BabylonRenderer split into parts):
 * ocean, sky, lights, ships and the camera are separate parts; this class only wires them and
 * syncs them from the simulation once per frame. The simulation is read, never written.
 */
/** Classes drawn with a modelled hull (tools/assets/hulls.json). */
const MODELLED_HULLS: readonly ShipClassId[] = ["galleon", "frigate", "brig"];

export interface RendererOptions {
  readonly canvas: HTMLCanvasElement;
  readonly graphics: GraphicsSettings;
  /** Where the modelled hulls lie (`<url><class>.glb`); omitted, every hull is generated. */
  readonly hullsUrl?: string;
  /** Folder of the tiling textures (deck, spars, sailcloth); plain colours without it. */
  readonly texturesUrl?: string;
  /** Folder of the prop models (wrecks for the shoals, the scanned gun); none without it. */
  readonly propsUrl?: string;
}

const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export interface FrameEnvironment {
  readonly hours: number;
  /** Fixed bearing of the sun (radians) for staged shots; omitted, the sun follows the hour. */
  readonly sunAzimuth?: number;
  /** Fallbacks when the simulation has no dynamic weather. */
  readonly overcast: number;
  readonly fog: number;
}

/** Highest device pixel ratio rendered (see the hardware scaling in the constructor). */
const MAX_PIXEL_RATIO = 2;

export class BabylonRenderer {
  readonly engine: Engine;
  readonly scene: Scene;
  readonly camera: FollowCamera;
  private readonly ocean: Ocean;
  private readonly sky: Sky;
  private readonly sun: DirectionalLight;
  private readonly ambient: HemisphericLight;
  /** Fill light on the ships in the playing cameras (ship-fill.ts); `shipFill.enabled = false` for the reference shots. */
  readonly shipFill: ShipFill;
  private readonly shadows: ShadowGenerator | null;
  private readonly materials: ShipMaterials;
  private readonly views = new Map<number, ShipView>();
  /** Where the ships have sailed: the wakes follow it (wake-trails). */
  private readonly trails = new WakeTrails();
  private readonly hulls: HullModels | null;
  private readonly instrumentation: SceneInstrumentation;
  private framed = false;
  /** Light level the unlit rigging lines were last drawn at, and seconds to the next check (lineLight). */
  private lineK = -1;
  private lineCheck = 0;
  private readonly effects: EffectsDirector;
  /** Ages every particle system by the frame's dt (particle-clock.ts). */
  private readonly particleClock: ParticleClock;
  /** Shake of the view when the player's guns fire, she is hit or something blows up near her (camera-shake.ts). */
  readonly shake = new CameraShake();
  private playerId = -1;
  private readonly weather: WeatherView;
  /** Fall-of-shot marks for the player's broadsides (the app sets them each frame). */
  readonly salvo: SalvoMarks;
  /** Simple steering: the course drawn and the route sailed, on the water. */
  readonly course: CourseView;
  /** Nearest enemy the isometric camera keeps in frame (the app sets it each frame). */
  focus: { x: number; z: number } | null = null;
  private coast: FarCoast | null = null;
  private islands: IslandsView | null = null;
  /** Where the camera was when the shallows' landmasses were last picked. */
  private shallowsAt: { x: number; z: number } | null = null;
  private readonly forts: FortsView;
  private towns: TownsView | null = null;
  private readonly wreckUrl: string | undefined;
  private readonly gunScan: GunScan | null;
  private readonly crewRig: CrewRig | null;
  private readonly treeBudget: number;
  /** The islands' textures (terrain-splat) and whether their grid is the dense one (high preset and up). */
  private readonly texturesUrl: string | undefined;
  private readonly fineLand: boolean;
  private readonly post: PostStack;
  private dropsLeft = 0;

  constructor(opts: RendererOptions) {
    const g = opts.graphics;
    this.engine = new Engine(opts.canvas, g.msaa > 1, { preserveDrawingBuffer: true, stencil: true }, true);
    // Pixel density capped at 2: a 3x phone screen shades 2.25 times the pixels of a 2x one for a
    // difference the eye does not find at arm's length (the cap three.js and most web games use).
    this.setRenderScale(g.renderScale);
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.5, 0.6, 0.7, 1);
    this.camera = new FollowCamera(this.scene, opts.canvas);
    this.sun = new DirectionalLight("sun", new Vector3(-0.4, -0.8, 0.3), this.scene);
    this.ambient = new HemisphericLight("sky-light", new Vector3(0, 1, 0), this.scene);
    this.ambient.groundColor = new Color3(0.05, 0.12, 0.15);
    // Made before the muzzle-flash lights, so it counts among the first lights of a ship's material.
    this.shipFill = new ShipFill(this.scene);
    this.shadows = g.shadowSize > 0 ? this.createShadows(g) : null;
    this.ocean = new Ocean(this.scene, g.oceanCells, g.detailWaves);
    this.sky = new Sky(this.scene, g.cloudOctaves, g.skyScale);
    this.materials = createShipMaterials(this.scene, opts.texturesUrl, opts.graphics.preset === "low" ? "low" : opts.graphics.preset === "medium" ? "medium" : "high");
    this.particleClock = new ParticleClock(this.scene);
    this.effects = new EffectsDirector(this.scene, this.particleClock, g.particles);
    // Spray and the cut in the sea follow the hull that is drawn (a modelled hull is longer than the physics hull).
    // Torn planks show the timber of the hull they came from: the model's baked planking, else the generated decks' planks.
    this.effects.plankTexture = (shipId) => {
      const def = this.views.get(shipId)?.model.def;
      return (def && this.hulls?.planks(def.id, def.hull)?.texture) ?? (this.materials.deck.diffuseTexture as Texture | null) ?? null;
    };
    this.effects.hullLength = (id, physical) => this.hulls?.fitted(id as ShipClassId, SHIP_CLASSES[id as ShipClassId].hull)?.length ?? physical;
    this.salvo = new SalvoMarks(this.scene);
    this.course = new CourseView(this.scene);
    this.weather = new WeatherView(this.scene, this.effects.sprites, this.camera.camera, g.particles);
    this.instrumentation = new SceneInstrumentation(this.scene);
    this.instrumentation.captureFrameTime = true;
    this.treeBudget = g.particles;
    this.texturesUrl = opts.texturesUrl;
    this.fineLand = g.preset !== "low" && g.preset !== "medium";
    this.forts = new FortsView(this.scene, this.shadows);
    this.wreckUrl = opts.propsUrl;
    this.gunScan = opts.propsUrl && opts.graphics.preset !== "low" ? new GunScan(this.scene, `${opts.propsUrl}gun.glb`) : null;
    this.crewRig = opts.propsUrl && opts.graphics.preset !== "low" ? new CrewRig(this.scene, `${opts.propsUrl}crew-anim.bin`) : null;
    this.hulls = opts.hullsUrl ? new HullModels(this.scene, opts.hullsUrl, opts.graphics.preset === "low" ? "-lite" : "") : null;
    void this.hulls?.load(MODELLED_HULLS);
    this.post = new PostStack(this.scene, this.camera.camera, g);
  }

  /** Shadows: cascaded maps on the higher presets (sharp close up, wide range), one map below. */
  private createShadows(g: GraphicsSettings): ShadowGenerator {
    if (g.cascades) {
      const c = new CascadedShadowGenerator(g.shadowSize, this.sun, undefined, this.camera.camera);
      c.numCascades = 4;
      c.lambda = 0.8;
      c.shadowMaxZ = 700;
      c.usePercentageCloserFiltering = true;
      c.stabilizeCascades = true;
      c.bias = 0.0007;
      c.normalBias = 0.02;
      return c;
    }
    const s = new ShadowGenerator(g.shadowSize, this.sun);
    s.usePercentageCloserFiltering = true;
    s.bias = 0.0008;
    s.normalBias = 0.02;
    this.sun.shadowMinZ = 1;
    this.sun.shadowMaxZ = 600;
    this.sun.autoUpdateExtends = true;
    return s;
  }

  private applyLook(look: SceneLook): void {
    // The key light: the sun by day, the moon by night (look.ts).
    this.sun.direction.set(-look.keyDir.x, -Math.max(0.05, look.keyDir.y), -look.keyDir.z);
    this.sun.position = this.sun.direction.scale(-300).add(this.camera.camera.target);
    this.sun.diffuse = new Color3(look.keyColor.r, look.keyColor.g, look.keyColor.b);
    this.sun.intensity = look.keyIntensity;
    this.lineLight(look.keyIntensity);
    // The sky the wet decks mirror (wet-deck.ts).
    const wet = wetSkyOf(this.scene);
    wet.horizon = look.skyHorizon;
    wet.zenith = look.skyZenith;
    // The lit haze over the land glows towards the key light as the ocean's does (sun-haze.ts).
    const haze = hazeSunOf(this.scene);
    haze.dir = look.keyDir;
    const hk = Math.min(1, look.keyIntensity / 2.2);
    haze.color = { r: look.keyColor.r * hk, g: look.keyColor.g * hk, b: look.keyColor.b * hk };
    // The same key light, through the canvas of the sails (sail-translucency.ts).
    const through = sailLightOf(this.scene);
    through.dir = { x: look.keyDir.x, y: Math.max(0.05, look.keyDir.y), z: look.keyDir.z };
    const k = look.keyIntensity * SAIL_TRANSMITTANCE;
    through.color = { r: look.keyColor.r * k, g: look.keyColor.g * k, b: look.keyColor.b * k };
    // Sky light: the hemisphere carries most of the fill on an overcast sea (no GI).
    this.ambient.diffuse = new Color3(look.ambient.r * 1.9, look.ambient.g * 1.9, look.ambient.b * 1.9);
    // Light from below: the sea throws back the sky (a ship's sides stand in it), stronger than a
    // dark ground would.
    this.ambient.groundColor = new Color3(look.ambient.r * 0.8, look.ambient.g * 0.95, look.ambient.b * 1.05);
    this.ambient.intensity = 1;
    setNightGlow(this.scene, 1 - Math.min(1, look.sunIntensity / 0.8), look.sunDir.y);
    // Eyes adjust to the night: up to 2 times the exposure once the sun is down (post-stack);
    // a storm by day stays dark, as it should.
    this.post.adapt(1 + 1.0 * Math.max(0, Math.min(1, (0.05 - look.sunDir.y) / 0.3)));
    this.towns?.setNight(1 - Math.min(1, look.sunIntensity / 0.8));
    this.effects.setLight(particleLight(look));
    this.scene.fogMode = Scene.FOGMODE_EXP;
    this.scene.fogDensity = look.fogDensity;
    // Haze lit by the sun behind it: a brighter, warmer fog than the bare horizon colour.
    this.scene.fogColor = new Color3(look.fogColor.r, look.fogColor.g, look.fogColor.b).scale(0.7).add(new Color3(look.sunColor.r, look.sunColor.g, look.sunColor.b).scale(0.35 * Math.min(1, look.sunIntensity + 0.3)));
  }

  private syncShips(sim: Simulation): void {
    const seen = new Set<number>();
    let changed = false;
    for (const e of sim.ships()) {
      seen.add(e.id);
      let v = this.views.get(e.id);
      // A ship bought in a yard keeps its id but changes hull: rebuild the view.
      // A ship bought in a yard keeps its id but changes hull, and a hull model may arrive after its ship: rebuild.
      if (v && (v.model !== e.ship!.model || (!v.modelled && this.hulls?.has(e.ship!.model.def.id)))) {
        v.dispose();
        v = undefined;
      }
      if (!v) {
        v = new ShipView(this.scene, e.id, e.ship!.model, e.ship!.faction, this.materials, this.shadows, this.hulls, this.gunScan, this.crewRig);
        this.views.set(e.id, v);
        changed = true;
      }
      v.sync(e, sim.env.windDirection, sim.env.windSpeed, sim.env.time);
      const cam = this.camera.camera.position;
      v.setDistance(Math.hypot(e.body!.pos.x - cam.x, e.body!.pos.z - cam.z));
    }
    // The crew's clips run on simulation time: the same deck on every run of a seed.
    this.crewRig?.setTime(sim.env.time);
    for (const [id, v] of this.views) {
      if (!seen.has(id)) {
        v.dispose();
        this.views.delete(id);
        changed = true;
      }
    }
    if (changed) this.shipFill.track([...this.views.values()].map((x) => x.root));
  }

  /**
   * How strong the screen-space sun shafts are (grade.ts): a low sun in front of the camera, fading
   * as it climbs, sets or goes behind heavy cloud (the reference's shafts are a low, backlit sun's).
   */
  private shaftStrength(look: SceneLook, toSun: Vector3): number {
    const ahead = Vector3.Dot(this.camera.camera.getForwardRay(1).direction, toSun);
    const low = smoothstep(-0.02, 0.08, look.sunDir.y) * (1 - smoothstep(0.35, 0.7, look.sunDir.y));
    return 0.9 * low * smoothstep(0.2, 0.6, ahead) * (1 - 0.8 * smoothstep(0.55, 0.9, look.cloudCover));
  }

  /** Domain events of the last steps (Observer): effects react to them. */
  onEvents(events: readonly DomainEvent[]): void {
    this.effects.onEvents(events);
    for (const e of events) {
      this.shakeFor(e);
      if (e.type === "gunFired") this.views.get(e.ship)?.gunFired(e.at);
      if (e.type === "hit" && (e.part === "hull" || e.part === "gun")) this.views.get(e.ship)?.shotHit(e.at, e.damage);
    }
    this.weather.onEvents(events);
  }

  frame(sim: Simulation, env: FrameEnvironment, dt: number): void {
    const w = sim.env.weather;
    const look = sceneLook(env.hours, w ? w.overcast : env.overcast, w ? w.fog : env.fog, env.sunAzimuth);
    const player = sim.player();
    this.playerId = player?.id ?? -1;
    if (player?.body) {
      const p = player.body.pos;
      if (!this.framed) {
        this.camera.frameShip(player.ship!.model.def.hull.length, Math.max(...player.ship!.model.def.masts.map((m) => m.height)));
        this.camera.snap(p.x, p.y, p.z);
        this.framed = true;
      } else {
        const r = player.body.rot;
        const h = player.ship!.model.def.hull;
        const c = player.ship!.model.com;
        // Eye at the break of the quarterdeck, well abaft the mainmast and above the waist, just off
        // the centreline (the reference's deck shot, ref_112: the mainmast before the eye, the
        // shrouds to either side, the deck running forward below, the sails against the sky).
        const main = player.ship!.model.def.masts.reduce((a, m) => (m.height > a.height ? m : a));
        const deckY = h.freeboard + 4.6 - c.y;
        this.camera.place({ x: p.x, y: p.y, z: p.z, qx: r.x, qy: r.y, qz: r.z, qw: r.w, deck: [0.5, deckY, main.z - 8 - c.z], length: h.length, focus: this.focus, surface: (x: number, z: number) => waterHeight(sim.env.waves, x, z, sim.env.time) }, dt);
      }
    }
    this.applyLook(look);
    this.shipFill.frame(this.camera.camera.getForwardRay(1).direction, this.camera.mode === "cinematic", 1 - Math.min(1, look.sunIntensity / 0.8), dt);
    const cam = this.camera.camera.position;
    if (!this.coast) {
      const main = sim.env.archipelago?.islands.find((is) => is.form === "mainland");
      this.coast = new FarCoast(this.scene, sim.env.seed, main ? Math.atan2(main.x, main.z) : null);
    }
    if (!this.islands && sim.env.archipelago) {
      this.islands = new IslandsView(this.scene, sim.env.archipelago, this.shadows, this.treeBudget, this.texturesUrl, this.fineLand);
      this.towns = new TownsView(this.scene, sim.env.archipelago, sim.ports);
      if (this.wreckUrl) void new WrecksView(this.scene, this.wreckUrl).place(wreckSites(sim.env.archipelago));
    }
    if (this.islands && sim.env.archipelago) {
      this.islands.update(cam.x, cam.z);
      // The shallows term takes the 32 landmasses nearest the camera: picked again whenever the camera has moved 300 m.
      if (!this.shallowsAt || Math.hypot(cam.x - this.shallowsAt.x, cam.z - this.shallowsAt.z) > 300) {
        this.shallowsAt = { x: cam.x, z: cam.z };
        this.ocean.setIslands(sim.env.archipelago.islands.map((is) => ({ is, d: shoreDistance(is, cam.x, cam.z) })).sort((p, q) => p.d - q.d).map((e) => e.is));
      }
    }
    this.coast.follow(cam.x, cam.z);
    this.coast.setHaze(this.scene.fogColor, look.fogDensity);
    const underside = 1 - 0.55 * smoothstep(0.4, 0.95, look.cloudCover);
    this.ocean.update(sim.env.waves, sim.env.time, cam.x, cam.z, {
      sunDirection: new Vector3(look.keyDir.x, look.keyDir.y, look.keyDir.z),
      // Glint and glitter follow the key light (a moon path at night): clouds take them away.
      sunColor: new Color3(look.keyColor.r, look.keyColor.g, look.keyColor.b).scale(Math.min(1, look.keyIntensity / 2.2)),
      // The sea reflects the sky over it: under a heavy sky that is the dark underside of the cloud,
      // not the clear sky's colours (ref_060). A lightning flash lights it (the flash of the last frame).
      skyZenith: new Color3(look.skyZenith.r, look.skyZenith.g, look.skyZenith.b).scale((1 + this.weather.flash * 4) * underside),
      skyHorizon: new Color3(look.skyHorizon.r, look.skyHorizon.g, look.skyHorizon.b).scale((1 + this.weather.flash * 3) * underside),
      fogColor: new Color3(look.fogColor.r, look.fogColor.g, look.fogColor.b),
      fogDensity: look.fogDensity,
      daylight: (look.sunDir.y + 0.05) / 0.35,
      // Under a heavy sky the sun's disc is behind the cloud and the sea has no path of light
      // (ref_060); through a broken sky it has (ref_090).
      // At night the moon's glitter is a few sparks near its path, not a field of them (ref_075; the
      // night exposure lifts every spark): a tenth of the day's.
      glint: (1 - 0.97 * smoothstep(0.5, 0.85, look.cloudCover)) * (1 - 0.9 * (1 - Math.min(1, look.sunIntensity / 0.8))),
    }, sim.env.windSpeed, sim.env.windDirection);
    const ws = sim.env.windSpeed;
    const strike = this.weather.strikeAt;
    const eye = this.camera.camera.position;
    const toStrike = strike ? new Vector3(strike.x - eye.x, 300, strike.z - eye.z).normalize() : null;
    this.sky.refresh(this.camera.camera.getForwardRay(1).direction, (this.weather.flash ?? 0) > 0);
    this.sky.update(look, sim.env.time, Math.sin(sim.env.windDirection) * ws, Math.cos(sim.env.windDirection) * ws, toStrike ? { x: toStrike.x, y: toStrike.y, z: toStrike.z, w: this.weather.flash } : null);
    this.updateScreen(sim, look, dt);
    const ships = sim.ships().map((e) => ({ id: e.id, x: e.body!.pos.x, z: e.body!.pos.z, heading: yawOf(e.body!.rot), speed: Math.max(0, rotateInv(e.body!.rot, e.body!.vel).z), length: this.hulls?.fitted(e.ship!.model.def.id, e.ship!.model.def.hull)?.length ?? e.ship!.model.def.hull.length, beam: e.ship!.model.def.hull.beam, slap: this.effects.slap.get(e.id) ?? 0, d: Math.hypot(e.body!.pos.x - cam.x, e.body!.pos.z - cam.z) }));
    this.ocean.setShips(ships.sort((a, b) => a.d - b.d));
    this.ocean.setTrails(this.trails.update(ships, sim.env.time));
    this.syncShips(sim);
    this.effects.frame(sim, dt, this.forts.sync(sim.forts(), sim.env.time));
    this.weather.frame(sim, dt);
    this.salvo.frame(sim.env.waves, sim.env.time, this.camera.mode === "isometric" ? this.camera.viewHalf : 60);
    this.course.frame(sim.env.waves, sim.env.time, this.camera.mode === "isometric" ? this.camera.viewHalf : 60);
    if (this.weather.flash > 0) {
      this.ambient.intensity = 1 + this.weather.flash * 3;
      this.scene.fogColor = this.scene.fogColor.add(new Color3(this.weather.flash * 0.4, this.weather.flash * 0.4, this.weather.flash * 0.5));
    }
    // The shake as a screen offset of the view, a fixed share of the view's size.
    const o = this.shake.step(dt);
    const reach = this.camera.mode === "isometric" ? this.camera.viewHalf * 0.05 : this.camera.mode === "deck" ? 0.25 : this.camera.camera.radius * 0.014;
    this.camera.camera.targetScreenOffset.set(o.x * reach, o.y * reach);
    this.particleClock.tick(dt);
    this.scene.render();
  }

  /** Trauma for the camera: the player's own guns, shot striking her, blasts and collisions close by. */
  private shakeFor(e: DomainEvent): void {
    const me = this.playerId;
    const near = (at: { x: number; z: number }, reach: number): number => {
      const p = this.views.get(me)?.root.position;
      return p ? Math.max(0, 1 - Math.hypot(at.x - p.x, at.z - p.z) / reach) : 0;
    };
    if (e.type === "gunFired" && e.ship === me) this.shake.add(0.045 * Math.sqrt(e.pounder / 12));
    else if (e.type === "hit" && e.ship === me) this.shake.add(0.1 + Math.min(0.2, e.damage * 0.01));
    else if (e.type === "collision" && (e.a === me || e.b === me)) this.shake.add(Math.min(0.6, e.speed * 0.15));
    else if (e.type === "explosion") this.shake.add(0.5 * near(e.at, 120));
    else if (e.type === "magazineExploded") this.shake.add(1.2 * near(e.at, 250));
  }

  /**
   * Effects only, without drawing: the shot tools fast-forward the simulation in steps of `dt`
   * and call this after each, so smoke and spray fired meanwhile are as old as the sim says.
   */
  advanceEffects(sim: Simulation, dt: number): void {
    this.effects.frame(sim, dt);
    this.weather.frame(sim, dt);
    this.particleClock.advance(dt);
  }

  /**
   * Under or above the water, where the sun is on screen, how wet the lens is. Underwater the
   * scene fog turns into water: teal and thick (light falls off within tens of metres).
   */
  private updateScreen(sim: Simulation, look: SceneLook, dt: number): void {
    const cam = this.camera.camera.position;
    const surface = waterHeight(sim.env.waves, cam.x, cam.z, sim.env.time);
    const under = cam.y < surface - 0.05;
    if (this.post.screen.underwater && !under) this.dropsLeft = 4;
    this.dropsLeft = Math.max(0, this.dropsLeft - dt);
    const rain = sim.env.weather?.rain ?? 0;
    // Under the water the sun is seen along its refracted ray, steeper than in the air (Snell, n = 1.33).
    const sd = under ? new Vector3(look.sunDir.x / 1.33, Math.sqrt(Math.max(0, 1 - (look.sunDir.x ** 2 + look.sunDir.z ** 2) / 1.77)), look.sunDir.z / 1.33) : new Vector3(look.sunDir.x, Math.max(0.02, look.sunDir.y), look.sunDir.z);
    const sun = Vector3.Project(cam.add(sd.scale(1000)), Matrix.Identity(), this.scene.getTransformMatrix(), this.camera.camera.viewport.toGlobal(1, 1));
    // Riding the surface: the lens as a dome of radius LENS; the surface crosses it at a height
    // that rises and falls with the passing waves (mid-frame when it cuts the lens centre).
    const LENS = 0.6;
    const h = cam.y - surface;
    const waterline = Math.abs(h) < LENS && this.camera.mode !== "isometric" ? 0.5 - h / (2 * LENS) : -1;
    Object.assign(this.post.screen, { drops: Math.min(1, rain * 0.9 + this.dropsLeft / 4), underwater: under, depth: Math.max(0, surface - cam.y), sunX: sun.x, sunY: 1 - sun.y, time: sim.env.time, flash: this.weather.flash, waterline, night: 1 - Math.min(1, look.sunIntensity / 0.8), shafts: this.shaftStrength(look, sd) });
    this.ocean.setUnderwater(under);
    if (under) {
      this.scene.fogColor = new Color3(0.02, 0.13, 0.12);
      this.scene.fogDensity = 0.035;
    }
  }

  /** Screen position of a world point as fractions of the canvas (0..1, y down). */
  project(x: number, y: number, z: number): { x: number; y: number } {
    const p = Vector3.Project(new Vector3(x, y, z), Matrix.Identity(), this.scene.getTransformMatrix(), this.camera.camera.viewport.toGlobal(1, 1));
    return { x: p.x, y: p.y };
  }

  /**
   * The point of the sea under a screen point (client pixels), or null above the horizon: the
   * picking ray (perspective or orthographic) met with the mean sea level.
   */
  pickWater(clientX: number, clientY: number): { x: number; z: number } | null {
    const rect = this.engine.getRenderingCanvasClientRect();
    if (!rect) return null;
    // CSS pixels from the canvas corner: Babylon divides by the hardware scaling itself (device
    // pixel ratio and render scale). Scaled here again, a tap landed 1.5 times as far from the
    // corner on a phone at DPR 2 and the medium preset (beta test 19.11).
    const ray = this.scene.createPickingRay(clientX - rect.left, clientY - rect.top, Matrix.Identity(), this.camera.camera);
    if (ray.direction.y > -1e-4) return null;
    const t = -ray.origin.y / ray.direction.y;
    if (t < 0 || t > 5000) return null;
    return { x: ray.origin.x + ray.direction.x * t, z: ray.origin.z + ray.direction.z * t };
  }

  /** Draw calls of the last frame: the performance gate (SpinalTap ADR-0046). */
  drawCalls(): number {
    return this.instrumentation.drawCallsCounter.current;
  }

  /**
   * The thin rigging drawn as lines (ratlines, far stays, running rigging) is unlit: its colour is
   * scaled with the key light, so at night it does not stand out pale against a darkened ship (the
   * ratlines read white in the night shot against ref_075). Checked a few times a second (new ships
   * bring new lines), redrawn only when the light has changed.
   */
  private lineLight(key: number): void {
    const k = Math.max(0.12, Math.min(1, key / 1.6));
    this.lineCheck -= 1 / 60;
    if (Math.abs(k - this.lineK) < 0.02 && this.lineCheck > 0) return;
    this.lineCheck = 0.5;
    this.lineK = k;
    for (const m of this.scene.meshes) {
      if (m.getClassName() !== "LinesMesh") continue;
      const lines = m as unknown as { color: Color3; metadata: { lineBase?: Color3 } | null };
      lines.metadata ??= {};
      const base = (lines.metadata.lineBase ??= lines.color.clone());
      lines.color.set(base.r * k, base.g * k, base.b * k);
    }
  }

  /** Share of the screen's pixels rendered (the settings slider, or dynamic resolution below it). */
  setRenderScale(scale: number): void {
    this.engine.setHardwareScalingLevel(1 / Math.max(0.3, Math.min(MAX_PIXEL_RATIO, globalThis.devicePixelRatio || 1) * scale));
  }

  resize(): void {
    this.engine.resize();
  }

  dispose(): void {
    this.scene.dispose();
    this.engine.dispose();
  }
}
