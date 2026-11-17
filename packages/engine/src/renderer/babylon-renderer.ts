import { type Simulation } from "@broadside/sim";
import { CascadedShadowGenerator, Matrix, Color3, Color4, DirectionalLight, Engine, HemisphericLight, Scene, SceneInstrumentation, ShadowGenerator, Vector3 } from "../babylon";
import { FollowCamera } from "../camera/follow-camera";
import { PostStack } from "./post-stack";
import { type GraphicsSettings } from "../graphics-settings";
import { Ocean } from "./ocean";
import { Sky } from "./sky";
import { type SceneLook, sceneLook } from "./look";
import { type ShipMaterials, ShipView, createShipMaterials, setNightGlow } from "./ship-view";
import { EffectsDirector } from "../effects/effects-director";
import { SalvoMarks } from "./salvo-marks";
import { HullModels } from "./hull-models";
import { WeatherView } from "./weather-view";
import { FarCoast } from "./far-coast";
import { IslandsView } from "./islands-view";
import { FortsView } from "./forts-view";
import { TownsView } from "./towns-view";
import { type DomainEvent, type ShipClassId, rotateInv, waterHeight, yawOf } from "@broadside/core";

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
}

export interface FrameEnvironment {
  readonly hours: number;
  /** Fallbacks when the simulation has no dynamic weather. */
  readonly overcast: number;
  readonly fog: number;
}

export class BabylonRenderer {
  readonly engine: Engine;
  readonly scene: Scene;
  readonly camera: FollowCamera;
  private readonly ocean: Ocean;
  private readonly sky: Sky;
  private readonly sun: DirectionalLight;
  private readonly ambient: HemisphericLight;
  private readonly shadows: ShadowGenerator | null;
  private readonly materials: ShipMaterials;
  private readonly views = new Map<number, ShipView>();
  private readonly hulls: HullModels | null;
  private readonly instrumentation: SceneInstrumentation;
  private framed = false;
  private readonly effects: EffectsDirector;
  private readonly weather: WeatherView;
  /** Fall-of-shot marks for the player's broadsides (the app sets them each frame). */
  readonly salvo: SalvoMarks;
  /** Nearest enemy the isometric camera keeps in frame (the app sets it each frame). */
  focus: { x: number; z: number } | null = null;
  private coast: FarCoast | null = null;
  private islands: IslandsView | null = null;
  private readonly forts: FortsView;
  private towns: TownsView | null = null;
  private readonly treeBudget: number;
  private readonly post: PostStack;
  private dropsLeft = 0;

  constructor(opts: RendererOptions) {
    const g = opts.graphics;
    this.engine = new Engine(opts.canvas, g.msaa > 1, { preserveDrawingBuffer: true, stencil: true }, true);
    this.engine.setHardwareScalingLevel(1 / Math.max(0.3, (globalThis.devicePixelRatio || 1) * g.renderScale));
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.5, 0.6, 0.7, 1);
    this.camera = new FollowCamera(this.scene, opts.canvas);
    this.sun = new DirectionalLight("sun", new Vector3(-0.4, -0.8, 0.3), this.scene);
    this.ambient = new HemisphericLight("sky-light", new Vector3(0, 1, 0), this.scene);
    this.ambient.groundColor = new Color3(0.05, 0.12, 0.15);
    this.shadows = g.shadowSize > 0 ? this.createShadows(g) : null;
    this.ocean = new Ocean(this.scene, g.oceanCells, g.detailWaves);
    this.sky = new Sky(this.scene, g.cloudOctaves);
    this.materials = createShipMaterials(this.scene);
    this.effects = new EffectsDirector(this.scene, g.particles);
    this.salvo = new SalvoMarks(this.scene);
    this.weather = new WeatherView(this.scene, this.effects.sprites, this.camera.camera, g.particles);
    this.instrumentation = new SceneInstrumentation(this.scene);
    this.instrumentation.captureFrameTime = true;
    this.treeBudget = g.particles;
    this.forts = new FortsView(this.scene, this.shadows);
    this.hulls = opts.hullsUrl ? new HullModels(this.scene, opts.hullsUrl, opts.graphics.preset === "low" || opts.graphics.preset === "medium" ? "-lite" : "") : null;
    void this.hulls?.load(MODELLED_HULLS);
    this.post = new PostStack(this.scene, this.engine, this.camera.camera, g, [this.sky.mesh]);
    this.forts.onBuilt = (m) => this.post.excludeFromShafts(m);
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
    if (this.post.sunDisc) {
      const c = this.camera.camera.position;
      this.post.sunDisc.position.set(c.x + look.sunDir.x * 900, c.y + Math.max(0.02, look.sunDir.y) * 900, c.z + look.sunDir.z * 900);
      this.post.sunDisc.isVisible = look.sunDir.y > -0.05;
    }
    // The key light: the sun by day, the moon by night (look.ts).
    this.sun.direction.set(-look.keyDir.x, -Math.max(0.05, look.keyDir.y), -look.keyDir.z);
    this.sun.position = this.sun.direction.scale(-300).add(this.camera.camera.target);
    this.sun.diffuse = new Color3(look.keyColor.r, look.keyColor.g, look.keyColor.b);
    this.sun.intensity = look.keyIntensity;
    // Sky light: the hemisphere carries most of the fill on an overcast sea (no GI).
    this.ambient.diffuse = new Color3(look.ambient.r * 1.9, look.ambient.g * 1.9, look.ambient.b * 1.9);
    this.ambient.groundColor = new Color3(look.ambient.r * 0.5, look.ambient.g * 0.65, look.ambient.b * 0.7);
    this.ambient.intensity = 1;
    setNightGlow(this.scene, 1 - Math.min(1, look.sunIntensity / 0.8));
    // Eyes adjust to the night: up to 2.2 times the exposure once the sun is down (post-stack);
    // a storm by day stays dark, as it should.
    this.post.adapt(1 + 1.2 * Math.max(0, Math.min(1, (0.05 - look.sunDir.y) / 0.3)));
    this.towns?.setNight(1 - Math.min(1, look.sunIntensity / 0.8));
    this.scene.fogMode = Scene.FOGMODE_EXP;
    this.scene.fogDensity = look.fogDensity;
    // Haze lit by the sun behind it: a brighter, warmer fog than the bare horizon colour.
    this.scene.fogColor = new Color3(look.fogColor.r, look.fogColor.g, look.fogColor.b).scale(0.7).add(new Color3(look.sunColor.r, look.sunColor.g, look.sunColor.b).scale(0.35 * Math.min(1, look.sunIntensity + 0.3)));
  }

  private syncShips(sim: Simulation): void {
    const seen = new Set<number>();
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
        v = new ShipView(this.scene, e.id, e.ship!.model, e.ship!.faction, this.materials, this.shadows, this.hulls);
        this.views.set(e.id, v);
      }
      v.sync(e, sim.env.windDirection, sim.env.windSpeed, sim.env.time);
      const cam = this.camera.camera.position;
      v.setDistance(Math.hypot(e.body!.pos.x - cam.x, e.body!.pos.z - cam.z));
    }
    for (const [id, v] of this.views) {
      if (!seen.has(id)) {
        v.dispose();
        this.views.delete(id);
      }
    }
  }

  /** Domain events of the last steps (Observer): effects react to them. */
  onEvents(events: readonly DomainEvent[]): void {
    this.effects.onEvents(events);
    for (const e of events) if (e.type === "gunFired") this.views.get(e.ship)?.gunFired(e.at);
    this.weather.onEvents(events);
  }

  frame(sim: Simulation, env: FrameEnvironment, dt: number): void {
    const w = sim.env.weather;
    const look = sceneLook(env.hours, w ? w.overcast : env.overcast, w ? w.fog : env.fog);
    const player = sim.player();
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
        // Eye in the waist, off the centreline between main and mizzen, a man's height above the
        // deck (the reference's deck shot looks up the mainmast through the shrouds).
        const deckY = h.freeboard + 1.8 - c.y;
        this.camera.place({ x: p.x, y: p.y, z: p.z, qx: r.x, qy: r.y, qz: r.z, qw: r.w, deck: [h.beam * 0.3, deckY, -h.length * 0.16 - c.z], length: h.length, focus: this.focus }, dt);
      }
    }
    this.applyLook(look);
    const cam = this.camera.camera.position;
    if (!this.coast) this.coast = new FarCoast(this.scene, sim.env.seed);
    if (!this.islands && sim.env.archipelago) {
      this.islands = new IslandsView(this.scene, sim.env.archipelago, this.shadows, this.treeBudget);
      this.post.excludeFromShafts(this.islands.meshes);
      this.towns = new TownsView(this.scene, sim.env.archipelago, sim.ports);
      this.post.excludeFromShafts(this.towns.meshes);
      this.ocean.setIslands(sim.env.archipelago.islands.map((is) => ({ ...is, d: Math.hypot(is.x - cam.x, is.z - cam.z) })).sort((p, q) => p.d - q.d));
    }
    this.coast.follow(cam.x, cam.z);
    this.ocean.update(sim.env.waves, sim.env.time, cam.x, cam.z, {
      sunDirection: new Vector3(look.keyDir.x, look.keyDir.y, look.keyDir.z),
      // Glint and glitter follow the key light (a moon path at night): clouds take them away.
      sunColor: new Color3(look.keyColor.r, look.keyColor.g, look.keyColor.b).scale(Math.min(1, look.keyIntensity / 2.2)),
      // A lightning flash lights the sky the sea reflects (the flash of the last frame).
      skyZenith: new Color3(look.skyZenith.r, look.skyZenith.g, look.skyZenith.b).scale(1 + this.weather.flash * 4),
      skyHorizon: new Color3(look.skyHorizon.r, look.skyHorizon.g, look.skyHorizon.b).scale(1 + this.weather.flash * 3),
      fogColor: new Color3(look.fogColor.r, look.fogColor.g, look.fogColor.b),
      fogDensity: look.fogDensity,
    }, sim.env.windSpeed, sim.env.windDirection);
    const ws = sim.env.windSpeed;
    this.sky.update(look, sim.env.time, Math.sin(sim.env.windDirection) * ws, Math.cos(sim.env.windDirection) * ws);
    this.updateScreen(sim, look, dt);
    const ships = sim.ships().map((e) => ({ x: e.body!.pos.x, z: e.body!.pos.z, heading: yawOf(e.body!.rot), speed: Math.max(0, rotateInv(e.body!.rot, e.body!.vel).z), length: e.ship!.model.def.hull.length, beam: e.ship!.model.def.hull.beam, d: Math.hypot(e.body!.pos.x - cam.x, e.body!.pos.z - cam.z) }));
    this.ocean.setShips(ships.sort((a, b) => a.d - b.d));
    this.syncShips(sim);
    this.effects.frame(sim, dt, this.forts.sync(sim.forts(), sim.env.time));
    this.weather.frame(sim, dt);
    this.salvo.frame(sim.env.waves, sim.env.time, this.camera.mode === "isometric" ? this.camera.viewHalf : 60);
    if (this.weather.flash > 0) {
      this.ambient.intensity = 1 + this.weather.flash * 3;
      this.scene.fogColor = this.scene.fogColor.add(new Color3(this.weather.flash * 0.4, this.weather.flash * 0.4, this.weather.flash * 0.5));
    }
    this.scene.render();
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
    const sun = Vector3.Project(cam.add(new Vector3(look.sunDir.x, Math.max(0.02, look.sunDir.y), look.sunDir.z).scale(1000)), Matrix.Identity(), this.scene.getTransformMatrix(), this.camera.camera.viewport.toGlobal(1, 1));
    // Riding the surface: the lens as a dome of radius LENS; the surface crosses it at a height
    // that rises and falls with the passing waves (mid-frame when it cuts the lens centre).
    const LENS = 0.6;
    const h = cam.y - surface;
    const waterline = Math.abs(h) < LENS && this.camera.mode !== "isometric" ? 0.5 - h / (2 * LENS) : -1;
    Object.assign(this.post.screen, { drops: Math.min(1, rain * 0.9 + this.dropsLeft / 4), underwater: under, depth: Math.max(0, surface - cam.y), sunX: sun.x, sunY: 1 - sun.y, time: sim.env.time, flash: this.weather.flash, waterline });
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

  /** Draw calls of the last frame: the performance gate (SpinalTap ADR-0046). */
  drawCalls(): number {
    return this.instrumentation.drawCallsCounter.current;
  }

  resize(): void {
    this.engine.resize();
  }

  dispose(): void {
    this.scene.dispose();
    this.engine.dispose();
  }
}
