import { type Simulation } from "@broadside/sim";
import { Color3, Color4, DefaultRenderingPipeline, DirectionalLight, Engine, HemisphericLight, Scene, SceneInstrumentation, ShadowGenerator, Vector3 } from "../babylon";
import { FollowCamera } from "../camera/follow-camera";
import { Ocean } from "./ocean";
import { Sky } from "./sky";
import { type SceneLook, sceneLook } from "./look";
import { type ShipMaterials, ShipView, createShipMaterials } from "./ship-view";
import { EffectsDirector } from "../effects/effects-director";
import { type DomainEvent } from "@broadside/core";

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
    this.instrumentation = new SceneInstrumentation(this.scene);
    this.instrumentation.captureFrameTime = true;
    if (opts.quality === "high") this.createPipeline();
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
    p.imageProcessing.exposure = 1.3;
    p.imageProcessing.contrast = 1.08;
    p.imageProcessing.vignetteEnabled = true;
    p.imageProcessing.vignetteWeight = 1.4;
  }

  private applyLook(look: SceneLook): void {
    this.sun.direction.set(-look.sunDir.x, -Math.max(0.05, look.sunDir.y), -look.sunDir.z);
    this.sun.position = this.sun.direction.scale(-300).add(this.camera.camera.target);
    this.sun.diffuse = new Color3(look.sunColor.r, look.sunColor.g, look.sunColor.b);
    this.sun.intensity = look.sunIntensity;
    // Sky light: the hemisphere carries most of the fill on an overcast sea (no GI).
    this.ambient.diffuse = new Color3(look.ambient.r * 1.9, look.ambient.g * 1.9, look.ambient.b * 1.9);
    this.ambient.groundColor = new Color3(look.ambient.r * 0.5, look.ambient.g * 0.65, look.ambient.b * 0.7);
    this.ambient.intensity = 1;
    // Sail cloth is translucent: the sun shows through from behind (cheap transmission term).
    const glow = 0.12 + 0.18 * Math.min(1, look.sunIntensity / 2);
    this.materials.sail.emissiveColor = new Color3(glow * look.sunColor.r, glow * look.sunColor.g, glow * 0.95 * look.sunColor.b);
    this.scene.fogMode = Scene.FOGMODE_EXP;
    this.scene.fogDensity = look.fogDensity;
    this.scene.fogColor = new Color3(look.fogColor.r, look.fogColor.g, look.fogColor.b);
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
  }

  frame(sim: Simulation, env: FrameEnvironment, dt: number): void {
    const look = sceneLook(env.hours, env.overcast, env.fog);
    const player = sim.player();
    if (player?.body) {
      const p = player.body.pos;
      if (!this.framed) {
        this.camera.frameShip(player.ship!.model.def.hull.length);
        this.camera.snap(p.x, p.y, p.z);
        this.framed = true;
      } else this.camera.follow(p.x, p.y, p.z, dt);
    }
    this.applyLook(look);
    const cam = this.camera.camera.position;
    this.ocean.update(sim.env.waves, sim.env.time, cam.x, cam.z, {
      sunDirection: new Vector3(look.sunDir.x, look.sunDir.y, look.sunDir.z),
      sunColor: new Color3(look.sunColor.r, look.sunColor.g, look.sunColor.b),
      skyZenith: new Color3(look.skyZenith.r, look.skyZenith.g, look.skyZenith.b),
      skyHorizon: new Color3(look.skyHorizon.r, look.skyHorizon.g, look.skyHorizon.b),
      fogColor: new Color3(look.fogColor.r, look.fogColor.g, look.fogColor.b),
      fogDensity: look.fogDensity,
    }, sim.env.windSpeed);
    const w = sim.env.windSpeed;
    this.sky.update(look, sim.env.time, Math.sin(sim.env.windDirection) * w, Math.cos(sim.env.windDirection) * w);
    this.syncShips(sim);
    this.effects.frame(sim, dt);
    this.scene.render();
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
