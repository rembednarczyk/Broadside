import { type Simulation } from "@broadside/sim";
import { Effect, Matrix, PostProcess, Color3, Color4, ColorCurves, DefaultRenderingPipeline, DirectionalLight, Engine, HemisphericLight, type Mesh, MeshBuilder, Scene, SceneInstrumentation, ShadowGenerator, StandardMaterial, Vector3, VolumetricLightScatteringPostProcess } from "../babylon";
import { FollowCamera } from "../camera/follow-camera";
import { GRADE_FRAGMENT } from "../shaders/grade";
import { createDropTexture } from "./lens-drops";
import { Ocean } from "./ocean";
import { Sky } from "./sky";
import { type SceneLook, sceneLook } from "./look";
import { type ShipMaterials, ShipView, createShipMaterials } from "./ship-view";
import { EffectsDirector } from "../effects/effects-director";
import { WeatherView } from "./weather-view";
import { FarCoast } from "./far-coast";
import { type DomainEvent, rotateInv, waterHeight, yawOf } from "@broadside/core";

/**
 * Facade over the Babylon scene (Facade, GoF; SpinalTap's BabylonRenderer split into parts):
 * ocean, sky, lights, ships and the camera are separate parts; this class only wires them and
 * syncs them from the simulation once per frame. The simulation is read, never written.
 */
export interface RendererOptions {
  readonly canvas: HTMLCanvasElement;
  /** Share of the device pixel ratio rendered (SpinalTap: 0.7 on phones). */
  readonly renderScale: number;
  readonly quality: "low" | "high";
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
  private readonly instrumentation: SceneInstrumentation;
  private framed = false;
  private readonly effects: EffectsDirector;
  private readonly weather: WeatherView;
  private coast: FarCoast | null = null;
  private sunDisc: Mesh | null = null;
  /** Screen-space state of the final pass, updated per frame. */
  private screen = { drops: 0, underwater: false, depth: 0, sunX: 0.5, sunY: 0.8, time: 0 };
  private dropsLeft = 0;

  constructor(opts: RendererOptions) {
    this.engine = new Engine(opts.canvas, opts.quality === "high", { preserveDrawingBuffer: true, stencil: true }, true);
    this.engine.setHardwareScalingLevel(1 / Math.max(0.3, (globalThis.devicePixelRatio || 1) * opts.renderScale));
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.5, 0.6, 0.7, 1);
    this.camera = new FollowCamera(this.scene, opts.canvas);
    this.sun = new DirectionalLight("sun", new Vector3(-0.4, -0.8, 0.3), this.scene);
    this.ambient = new HemisphericLight("sky-light", new Vector3(0, 1, 0), this.scene);
    this.ambient.groundColor = new Color3(0.05, 0.12, 0.15);
    this.shadows = opts.quality === "high" ? this.createShadows() : null;
    this.ocean = new Ocean(this.scene);
    this.sky = new Sky(this.scene);
    this.materials = createShipMaterials(this.scene);
    this.effects = new EffectsDirector(this.scene);
    this.weather = new WeatherView(this.scene, this.effects.sprites, this.camera.camera);
    this.instrumentation = new SceneInstrumentation(this.scene);
    this.instrumentation.captureFrameTime = true;
    if (opts.quality === "high") {
      this.createPipeline();
      this.createSunShafts();
    }
  }

  private createShadows(): ShadowGenerator {
    const g = new ShadowGenerator(2048, this.sun);
    g.usePercentageCloserFiltering = true;
    g.bias = 0.0008;
    g.normalBias = 0.02;
    this.sun.shadowMinZ = 1;
    this.sun.shadowMaxZ = 600;
    this.sun.autoUpdateExtends = true;
    return g;
  }

  private createPipeline(): void {
    const p = new DefaultRenderingPipeline("post", true, this.scene, [this.camera.camera]);
    p.fxaaEnabled = true;
    p.bloomEnabled = true;
    p.bloomThreshold = 0.85;
    p.bloomWeight = 0.25;
    p.bloomKernel = 48;
    p.imageProcessingEnabled = true;
    p.imageProcessing.toneMappingEnabled = true;
    p.imageProcessing.toneMappingType = 1; // ACES
    p.imageProcessing.exposure = 0.95;
    p.imageProcessing.contrast = 1.45;
    p.imageProcessing.vignetteEnabled = true;
    p.imageProcessing.vignetteWeight = 2.2;
    // Grade after the visual reference (decyzje 16.11): desaturated, warm sepia highlights,
    // slightly cool shadows, high contrast (a lift-gamma-gain style grade via colour curves).
    const curves = new ColorCurves();
    curves.globalSaturation = -40;
    curves.highlightsHue = 40;
    curves.highlightsDensity = 55;
    curves.highlightsSaturation = 25;
    curves.midtonesHue = 38;
    curves.midtonesDensity = 40;
    curves.shadowsHue = 35;
    curves.shadowsDensity = 20;
    curves.shadowsExposure = -30;
    p.imageProcessing.colorCurvesEnabled = true;
    p.imageProcessing.colorCurves = curves;
    // Sepia split-tone after the pipeline (the reference's monochrome warmth).
    Effect.ShadersStore["gradeFragmentShader"] = GRADE_FRAGMENT;
    const grade = new PostProcess("grade", "grade", ["amount", "contrast", "drops", "underwater", "depth", "sunScreen", "flash", "time"], ["dropSampler"], 1, this.camera.camera);
    const dropTex = createDropTexture(this.scene);
    grade.onApply = (e) => {
      const f = this.screen;
      e.setTexture("dropSampler", dropTex);
      e.setFloat("amount", 0.72);
      e.setFloat("contrast", 1.12);
      e.setFloat("drops", f.drops);
      e.setFloat("underwater", f.underwater ? 1 : 0);
      e.setFloat("depth", f.depth);
      e.setFloat2("sunScreen", f.sunX, f.sunY);
      e.setFloat("flash", this.weather.flash);
      e.setFloat("time", f.time);
    };
    p.bloomThreshold = 0.8;
    p.bloomWeight = 0.35;
    p.bloomKernel = 32;
  }

  /**
   * Crepuscular rays through the rigging: volumetric light scattering as a screen-space radial
   * blur from the sun (K. Mitchell, "Volumetric Light Scattering as a Post-Process", GPU Gems 3,
   * ch. 13). The sun is a bright disc kept far along the sun direction from the camera.
   */
  private createSunShafts(): void {
    const disc = MeshBuilder.CreateSphere("sun-disc", { diameter: 70, segments: 12 }, this.scene);
    // Only the shafts pass sees the disc; the sky shader draws the visible sun.
    disc.layerMask = 0x20000000;
    const m = new StandardMaterial("sun-disc", this.scene);
    m.emissiveColor = new Color3(1, 0.92, 0.75);
    m.disableLighting = true;
    disc.material = m;
    disc.applyFog = false;
    disc.isPickable = false;
    const vls = new VolumetricLightScatteringPostProcess("shafts", 0.5, this.camera.camera, disc, 60, 2, this.engine, false, this.scene);
    vls.exposure = 0.22;
    vls.decay = 0.965;
    vls.weight = 0.6;
    vls.density = 0.9;
    vls.excludedMeshes = [this.sky.mesh];
    this.sunDisc = disc;
  }

  private applyLook(look: SceneLook): void {
    if (this.sunDisc) {
      const c = this.camera.camera.position;
      this.sunDisc.position.set(c.x + look.sunDir.x * 900, c.y + Math.max(0.02, look.sunDir.y) * 900, c.z + look.sunDir.z * 900);
      this.sunDisc.isVisible = look.sunDir.y > -0.05;
    }
    this.sun.direction.set(-look.sunDir.x, -Math.max(0.05, look.sunDir.y), -look.sunDir.z);
    this.sun.position = this.sun.direction.scale(-300).add(this.camera.camera.target);
    this.sun.diffuse = new Color3(look.sunColor.r, look.sunColor.g, look.sunColor.b);
    this.sun.intensity = look.sunIntensity;
    // Sky light: the hemisphere carries most of the fill on an overcast sea (no GI).
    this.ambient.diffuse = new Color3(look.ambient.r * 1.9, look.ambient.g * 1.9, look.ambient.b * 1.9);
    this.ambient.groundColor = new Color3(look.ambient.r * 0.5, look.ambient.g * 0.65, look.ambient.b * 0.7);
    this.ambient.intensity = 1;
    // Sail cloth is translucent: the sun shows through from behind (cheap transmission term).
    const glow = 0.05 + 0.1 * Math.min(1, look.sunIntensity / 2);
    this.materials.sail.emissiveColor = new Color3(glow * look.sunColor.r, glow * look.sunColor.g, glow * 0.95 * look.sunColor.b);
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
      if (!v) {
        v = new ShipView(this.scene, e.id, e.ship!.model, e.ship!.faction, this.materials, this.shadows);
        this.views.set(e.id, v);
      }
      v.sync(e, sim.env.windDirection, sim.env.windSpeed, sim.env.time);
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
      } else this.camera.follow(p.x, p.y, p.z, dt);
    }
    this.applyLook(look);
    const cam = this.camera.camera.position;
    if (!this.coast) this.coast = new FarCoast(this.scene, sim.env.seed);
    this.coast.follow(cam.x, cam.z);
    this.ocean.update(sim.env.waves, sim.env.time, cam.x, cam.z, {
      sunDirection: new Vector3(look.sunDir.x, look.sunDir.y, look.sunDir.z),
      // Glint and glitter follow the direct sun: clouds take them away.
      sunColor: new Color3(look.sunColor.r, look.sunColor.g, look.sunColor.b).scale(Math.min(1, look.sunIntensity / 2.2)),
      skyZenith: new Color3(look.skyZenith.r, look.skyZenith.g, look.skyZenith.b),
      skyHorizon: new Color3(look.skyHorizon.r, look.skyHorizon.g, look.skyHorizon.b),
      fogColor: new Color3(look.fogColor.r, look.fogColor.g, look.fogColor.b),
      fogDensity: look.fogDensity,
    }, sim.env.windSpeed);
    const ws = sim.env.windSpeed;
    this.sky.update(look, sim.env.time, Math.sin(sim.env.windDirection) * ws, Math.cos(sim.env.windDirection) * ws);
    this.updateScreen(sim, look, dt);
    const ships = sim.ships().map((e) => ({ x: e.body!.pos.x, z: e.body!.pos.z, heading: yawOf(e.body!.rot), speed: Math.max(0, rotateInv(e.body!.rot, e.body!.vel).z), length: e.ship!.model.def.hull.length, beam: e.ship!.model.def.hull.beam, d: Math.hypot(e.body!.pos.x - cam.x, e.body!.pos.z - cam.z) }));
    this.ocean.setShips(ships.sort((a, b) => a.d - b.d));
    this.syncShips(sim);
    this.effects.frame(sim, dt);
    this.weather.frame(sim, dt);
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
    if (this.screen.underwater && !under) this.dropsLeft = 4;
    this.dropsLeft = Math.max(0, this.dropsLeft - dt);
    const rain = sim.env.weather?.rain ?? 0;
    const sun = Vector3.Project(cam.add(new Vector3(look.sunDir.x, Math.max(0.02, look.sunDir.y), look.sunDir.z).scale(1000)), Matrix.Identity(), this.scene.getTransformMatrix(), this.camera.camera.viewport.toGlobal(1, 1));
    this.screen = { drops: Math.min(1, rain * 0.9 + this.dropsLeft / 4), underwater: under, depth: Math.max(0, surface - cam.y), sunX: sun.x, sunY: 1 - sun.y, time: sim.env.time };
    this.ocean.setUnderwater(under);
    if (under) {
      this.scene.fogColor = new Color3(0.02, 0.13, 0.12);
      this.scene.fogDensity = 0.035;
    }
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
