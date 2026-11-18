import { type Camera, ColorCurves, DefaultRenderingPipeline, Effect, type Engine, type Mesh, MeshBuilder, MotionBlurPostProcess, PostProcess, SSAO2RenderingPipeline, type Scene, StandardMaterial, Color3, VolumetricLightScatteringPostProcess } from "../babylon";
import { GRADE_FRAGMENT } from "../shaders/grade";
import { createDropTexture } from "./lens-drops";
import { type ColorMode, type GraphicsSettings } from "../graphics-settings";

/**
 * Colour modes as data: sepia (the visual reference, default), natural (neutral, true to the
 * scene's colours) and vibrant (saturated, punchy). Curves feed Babylon's image processing;
 * `sepia` and `contrast` feed the final pass.
 */
interface ColorLook {
  readonly saturation: number;
  readonly highlightsHue: number;
  readonly highlightsDensity: number;
  readonly shadowsDensity: number;
  readonly shadowsExposure: number;
  readonly exposure: number;
  readonly contrast: number;
  readonly sepia: number;
  readonly finalContrast: number;
}

const COLOR_LOOKS: Readonly<Record<ColorMode, ColorLook>> = {
  sepia: { saturation: -40, highlightsHue: 40, highlightsDensity: 55, shadowsDensity: 20, shadowsExposure: -30, exposure: 1.15, contrast: 1.45, sepia: 0.72, finalContrast: 1.12 },
  natural: { saturation: 0, highlightsHue: 40, highlightsDensity: 8, shadowsDensity: 0, shadowsExposure: -8, exposure: 1.05, contrast: 1.2, sepia: 0, finalContrast: 1.04 },
  vibrant: { saturation: 35, highlightsHue: 35, highlightsDensity: 15, shadowsDensity: 10, shadowsExposure: -12, exposure: 1.1, contrast: 1.3, sepia: 0, finalContrast: 1.1 },
};

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
  /** Height of the water surface on the lens (0 bottom .. 1 top) while the camera rides the surface; -1 otherwise. */
  waterline: number;
  /** 0 by day .. 1 at night: the toning cools from sepia towards a neutral grey (grade.ts). */
  night: number;
}

export class PostStack {
  readonly screen: ScreenState = { drops: 0, underwater: false, depth: 0, sunX: 0.5, sunY: 0.8, time: 0, flash: 0, waterline: -1, night: 0 };
  readonly sunDisc: Mesh | null;
  private shaftsPass: VolumetricLightScatteringPostProcess | null = null;
  private processing: DefaultRenderingPipeline["imageProcessing"] | null = null;
  private baseExposure = 1;

  constructor(scene: Scene, engine: Engine, camera: Camera, g: GraphicsSettings, excludeFromShafts: Mesh[]) {
    if (g.ssao) {
      const ssao = new SSAO2RenderingPipeline("ssao", scene, { ssaoRatio: 0.5, blurRatio: 0.5 }, [camera], false);
      ssao.radius = 2;
      ssao.totalStrength = 1.1;
      ssao.samples = 16;
      ssao.maxZ = 400;
    }
    this.pipeline(scene, camera, g);
    // SSAO renders the scene through Babylon's pre-pass (multiple render targets), and the pipeline's
    // MSAA then only reaches the finished image, where it smooths nothing: the samples belong on the
    // pre-pass, where the geometry is drawn (the ultra and cinematic presets had no anti-aliasing).
    if (g.ssao) {
      const pre = scene.enablePrePassRenderer();
      if (pre) pre.samples = g.msaa;
    }
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
    // Below full resolution the upscaled frame softens: a light unsharp mask restores the edges
    // (the sharpening pass that follows the upscale in FSR and DLSS, here Babylon's sharpen).
    if (g.renderScale < 0.95) {
      p.sharpenEnabled = true;
      p.sharpen.edgeAmount = Math.min(0.45, (1 - g.renderScale) * 1.2);
      p.sharpen.colorAmount = 1;
    }
    p.bloomEnabled = g.bloom;
    // A wide, soft glow round the sun and its glitter (the reference's blown-out sky): a lower
    // threshold and a broad kernel from the high preset up.
    p.bloomThreshold = 0.72;
    p.bloomWeight = 0.45;
    p.bloomKernel = g.msaa >= 2 ? 72 : 32;
    p.imageProcessingEnabled = true;
    p.imageProcessing.toneMappingEnabled = true;
    p.imageProcessing.toneMappingType = 1; // ACES
    const look = COLOR_LOOKS[g.colorMode];
    p.imageProcessing.exposure = look.exposure;
    this.processing = p.imageProcessing;
    this.baseExposure = look.exposure;
    p.imageProcessing.contrast = look.contrast;
    p.imageProcessing.vignetteEnabled = true;
    p.imageProcessing.vignetteWeight = 2.2;
    const curves = new ColorCurves();
    curves.globalSaturation = look.saturation;
    curves.highlightsHue = look.highlightsHue;
    curves.highlightsDensity = look.highlightsDensity;
    curves.highlightsSaturation = g.colorMode === "sepia" ? 25 : 0;
    curves.midtonesHue = 38;
    curves.midtonesDensity = g.colorMode === "sepia" ? 40 : 0;
    curves.shadowsHue = g.colorMode === "sepia" ? 35 : 210;
    curves.shadowsDensity = look.shadowsDensity;
    curves.shadowsExposure = look.shadowsExposure;
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
    this.shaftsPass = vls;
    return disc;
  }

  /** Meshes that need not occlude the sun shafts (land, forts): saves a full re-render of them. */
  /**
   * Eye adaptation (auto exposure with a clamped range, as in Unreal's and Unity HDRP's exposure):
   * the scene's exposure follows the light level, up to `gain` times the colour mode's own in
   * the dark. Driven by the key light here, a cheap stand-in for a measured luminance histogram.
   */
  adapt(gain: number): void {
    if (this.processing) this.processing.exposure = this.baseExposure * gain;
  }

  excludeFromShafts(meshes: readonly Mesh[]): void {
    this.shaftsPass?.excludedMeshes.push(...meshes);
  }

  private finalPass(scene: Scene, camera: Camera, g: GraphicsSettings): void {
    Effect.ShadersStore["gradeFragmentShader"] = GRADE_FRAGMENT;
    const grade = new PostProcess("grade", "grade", ["amount", "contrast", "drops", "underwater", "depth", "sunScreen", "flash", "time", "waterline", "night"], ["dropSampler"], 1, camera);
    const dropTex = createDropTexture(scene);
    grade.onApply = (e) => {
      const f = this.screen;
      e.setTexture("dropSampler", dropTex);
      e.setFloat("amount", COLOR_LOOKS[g.colorMode].sepia);
      e.setFloat("contrast", COLOR_LOOKS[g.colorMode].finalContrast);
      e.setFloat("drops", g.lens ? f.drops : 0);
      e.setFloat("underwater", f.underwater ? 1 : 0);
      e.setFloat("depth", f.depth);
      e.setFloat2("sunScreen", f.sunX, f.sunY);
      e.setFloat("flash", g.lens ? f.flash : f.flash * 0.3);
      e.setFloat("time", f.time);
      e.setFloat("waterline", f.waterline);
      e.setFloat("night", f.night);
    };
  }
}
