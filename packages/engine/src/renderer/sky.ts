import { Color3, type Engine, Mesh, MeshBuilder, RawTexture3D, type Scene, ShaderMaterial, Texture, Vector2, Vector3, Vector4 } from "../babylon";
import { CLOUD_NOISE_SIZE, cloudNoiseVolume } from "../shaders/cloud-noise";
import { SKY_VERTEX, skyFragment } from "../shaders/sky";
import { type SceneLook } from "./look";

/** Babylon's `Constants.TEXTUREFORMAT_RGBA`. */
const RGBA_FORMAT = 5;

/** Sky dome drawn behind everything (depth at the far plane), centred on the camera. */
export class Sky {
  readonly mesh: Mesh;
  private readonly material: ShaderMaterial;

  constructor(scene: Scene, octaves = 5) {
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
