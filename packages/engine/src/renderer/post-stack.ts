import { type Camera, ColorCurves, DefaultRenderingPipeline, Effect, type Engine, type Mesh, MeshBuilder, MotionBlurPostProcess, PostProcess, SSAO2RenderingPipeline, type Scene, StandardMaterial, Color3, VolumetricLightScatteringPostProcess } from "../babylon";
import { GRADE_FRAGMENT } from "../shaders/grade";
import { createDropTexture } from "./lens-drops";
import { type GraphicsSettings } from "../graphics-settings";

/**
 * The post-processing chain, configured by the graphics settings (Strategy by data): SSAO2 →
 * default pipeline (MSAA, bloom, ACES tone mapping, colour curves, vignette) → sun shafts
 * (GPU Gems 3 ch. 13) → motion blur → the final pass (lens, underwater, lightning, sepia grade).
 */
export interface ScreenState {
  drops: number;
  underwater: boolean;
  depth: number;
  sunX: number;
  sunY: number;
  time: number;
  flash: number;
}

export class PostStack {
  readonly screen: ScreenState = { drops: 0, underwater: false, depth: 0, sunX: 0.5, sunY: 0.8, time: 0, flash: 0 };
  readonly sunDisc: Mesh | null;

  constructor(scene: Scene, engine: Engine, camera: Camera, g: GraphicsSettings, excludeFromShafts: Mesh[]) {
    if (g.ssao) {
      const ssao = new SSAO2RenderingPipeline("ssao", scene, { ssaoRatio: 0.5, blurRatio: 0.5 }, [camera], false);
      ssao.radius = 2;
      ssao.totalStrength = 1.1;
      ssao.samples = 16;
      ssao.maxZ = 400;
    }
    this.pipeline(scene, camera, g);
    this.sunDisc = g.sunShafts > 0 ? this.shafts(scene, engine, camera, g.sunShafts, excludeFromShafts) : null;
    if (g.motionBlur) {
      const mb = new MotionBlurPostProcess("motion", scene, 1, camera);
      mb.motionStrength = 0.6;
      mb.motionBlurSamples = 16;
      mb.isObjectBased = false;
    }
    this.finalPass(scene, camera, g);
  }

  private pipeline(scene: Scene, camera: Camera, g: GraphicsSettings): void {
    const p = new DefaultRenderingPipeline("post", true, scene, [camera]);
    p.samples = g.msaa;
    p.fxaaEnabled = g.msaa === 1;
    p.bloomEnabled = g.bloom;
    p.bloomThreshold = 0.8;
    p.bloomWeight = 0.35;
    p.bloomKernel = g.msaa >= 4 ? 64 : 32;
    p.imageProcessingEnabled = true;
    p.imageProcessing.toneMappingEnabled = true;
    p.imageProcessing.toneMappingType = 1; // ACES
    p.imageProcessing.exposure = 0.95;
    p.imageProcessing.contrast = 1.45;
    p.imageProcessing.vignetteEnabled = true;
    p.imageProcessing.vignetteWeight = 2.2;
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
  }

  private shafts(scene: Scene, engine: Engine, camera: Camera, samples: number, exclude: Mesh[]): Mesh {
    const disc = MeshBuilder.CreateSphere("sun-disc", { diameter: 70, segments: 12 }, scene);
    // Only the shafts pass sees the disc; the sky shader draws the visible sun.
    disc.layerMask = 0x20000000;
    const m = new StandardMaterial("sun-disc", scene);
    m.emissiveColor = new Color3(1, 0.92, 0.75);
    m.disableLighting = true;
    disc.material = m;
    disc.applyFog = false;
    disc.isPickable = false;
    const vls = new VolumetricLightScatteringPostProcess("shafts", 0.5, camera, disc, samples, 2, engine, false, scene);
    vls.exposure = 0.22;
    vls.decay = 0.965;
    vls.weight = 0.6;
    vls.density = 0.9;
    vls.excludedMeshes = exclude;
    return disc;
  }

  private finalPass(scene: Scene, camera: Camera, g: GraphicsSettings): void {
    Effect.ShadersStore["gradeFragmentShader"] = GRADE_FRAGMENT;
    const grade = new PostProcess("grade", "grade", ["amount", "contrast", "drops", "underwater", "depth", "sunScreen", "flash", "time"], ["dropSampler"], 1, camera);
    const dropTex = createDropTexture(scene);
    grade.onApply = (e) => {
      const f = this.screen;
      e.setTexture("dropSampler", dropTex);
      e.setFloat("amount", 0.72);
      e.setFloat("contrast", 1.12);
      e.setFloat("drops", g.lens ? f.drops : 0);
      e.setFloat("underwater", f.underwater ? 1 : 0);
      e.setFloat("depth", f.depth);
      e.setFloat2("sunScreen", f.sunX, f.sunY);
      e.setFloat("flash", g.lens ? f.flash : f.flash * 0.3);
      e.setFloat("time", f.time);
    };
  }
}
