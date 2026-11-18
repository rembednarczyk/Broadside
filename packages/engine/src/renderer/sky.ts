import { Color3, Color4, type Engine, Layer, Mesh, MeshBuilder, RawTexture3D, RenderTargetTexture, type Scene, ShaderMaterial, Texture, Vector2, Vector3, Vector4 } from "../babylon";
import { CLOUD_NOISE_SIZE, cloudNoiseVolume } from "../shaders/cloud-noise";
import { SKY_VERTEX, skyFragment } from "../shaders/sky";
import { type SceneLook } from "./look";

/** Babylon's `Constants.TEXTUREFORMAT_RGBA` and `Constants.TEXTURETYPE_HALF_FLOAT`. */
const RGBA_FORMAT = 5;
const HALF_FLOAT = 2;

/** Sky dome drawn behind everything (depth at the far plane), centred on the camera. */
export class Sky {
  readonly mesh: Mesh;
  private readonly material: ShaderMaterial;

  /**
   * `scale` below 1: the dome is drawn into a texture of that share of the frame and shown as the
   * background (a Layer), the rest of the scene on top at full resolution. The volumetric clouds are
   * the costliest pixels of a frame and soft: at half resolution they lose next to nothing, while
   * the masts, rigging and coast against them keep full-resolution edges (the same idea as the
   * half-resolution volumetrics of game engines, without the temporal reprojection). The texture is
   * half-float: the sun's core stays above 1 for the bloom.
   */
  constructor(scene: Scene, octaves = 5, scale = 1) {
    this.mesh = MeshBuilder.CreateSphere("sky", { diameter: 2000, segments: 24, sideOrientation: Mesh.BACKSIDE }, scene);
    // Top presets read the clouds' lumps from a noise volume (3D textures need WebGL2).
    const noiseVolume = octaves >= 6 && (scene.getEngine() as Engine).webGLVersion >= 2;
    this.material = new ShaderMaterial("sky", scene, { vertexSource: SKY_VERTEX, fragmentSource: skyFragment(octaves, noiseVolume) }, {
      attributes: ["position"],
      uniforms: ["worldViewProjection", "sunDirection", "sunColor", "skyZenith", "skyHorizon", "cloudCover", "time", "windOffset", "lightning"],
      samplers: noiseVolume ? ["cloudNoise"] : [],
    });
    if (noiseVolume) {
      const n = CLOUD_NOISE_SIZE;
      const volume = new RawTexture3D(cloudNoiseVolume(n), n, n, n, RGBA_FORMAT, scene, false, false, Texture.BILINEAR_SAMPLINGMODE);
      volume.wrapU = volume.wrapV = volume.wrapR = Texture.WRAP_ADDRESSMODE;
      this.material.setTexture("cloudNoise", volume);
    }
    this.material.backFaceCulling = false;
    this.material.disableDepthWrite = true;
    this.mesh.material = this.material;
    this.mesh.infiniteDistance = true;
    this.mesh.isPickable = false;
    if (scale < 1) this.backdrop(scene, scale);
  }

  private backdrop(scene: Scene, scale: number): void {
    const target = new RenderTargetTexture("sky-backdrop", { ratio: scale }, scene, false, true, HALF_FLOAT);
    target.renderList = [this.mesh];
    target.clearColor = new Color4(0, 0, 0, 1);
    // The dome shows only in its own pass, not in the frame (the layer stands in for it there).
    this.mesh.isVisible = false;
    target.onBeforeRenderObservable.add(() => {
      this.mesh.isVisible = true;
    });
    target.onAfterRenderObservable.add(() => {
      this.mesh.isVisible = false;
    });
    scene.customRenderTargets.push(target);
    const layer = new Layer("sky-backdrop", null, scene, true);
    layer.texture = target;
  }

  /** `lightning`: unit direction from the eye to a strike and the flash's brightness (w), or none. */
  update(look: SceneLook, time: number, windX: number, windZ: number, lightning: { x: number; y: number; z: number; w: number } | null = null): void {
    this.material.setVector4("lightning", lightning ? new Vector4(lightning.x, lightning.y, lightning.z, lightning.w) : new Vector4(0, 1, 0, 0));
    this.material.setVector3("sunDirection", new Vector3(look.sunDir.x, look.sunDir.y, look.sunDir.z));
    this.material.setColor3("sunColor", new Color3(look.sunColor.r, look.sunColor.g, look.sunColor.b));
    this.material.setColor3("skyZenith", new Color3(look.skyZenith.r, look.skyZenith.g, look.skyZenith.b));
    this.material.setColor3("skyHorizon", new Color3(look.skyHorizon.r, look.skyHorizon.g, look.skyHorizon.b));
    this.material.setFloat("cloudCover", look.cloudCover);
    this.material.setFloat("time", time);
    this.material.setVector2("windOffset", new Vector2(windX * time, windZ * time));
  }
}
