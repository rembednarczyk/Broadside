import { Color3, Mesh, MeshBuilder, type Scene, ShaderMaterial, Vector2, Vector3 } from "../babylon";
import { SKY_VERTEX, skyFragment } from "../shaders/sky";
import { type SceneLook } from "./look";

/** Sky dome drawn behind everything (depth at the far plane), centred on the camera. */
export class Sky {
  readonly mesh: Mesh;
  private readonly material: ShaderMaterial;

  constructor(scene: Scene, octaves = 5) {
    this.mesh = MeshBuilder.CreateSphere("sky", { diameter: 2000, segments: 24, sideOrientation: Mesh.BACKSIDE }, scene);
    this.material = new ShaderMaterial("sky", scene, { vertexSource: SKY_VERTEX, fragmentSource: skyFragment(octaves) }, {
      attributes: ["position"],
      uniforms: ["worldViewProjection", "sunDirection", "sunColor", "skyZenith", "skyHorizon", "cloudCover", "time", "windOffset"],
    });
    this.material.backFaceCulling = false;
    this.material.disableDepthWrite = true;
    this.mesh.material = this.material;
    this.mesh.infiniteDistance = true;
    this.mesh.isPickable = false;
  }

  update(look: SceneLook, time: number, windX: number, windZ: number): void {
    this.material.setVector3("sunDirection", new Vector3(look.sunDir.x, look.sunDir.y, look.sunDir.z));
    this.material.setColor3("sunColor", new Color3(look.sunColor.r, look.sunColor.g, look.sunColor.b));
    this.material.setColor3("skyZenith", new Color3(look.skyZenith.r, look.skyZenith.g, look.skyZenith.b));
    this.material.setColor3("skyHorizon", new Color3(look.skyHorizon.r, look.skyHorizon.g, look.skyHorizon.b));
    this.material.setFloat("cloudCover", look.cloudCover);
    this.material.setFloat("time", time);
    this.material.setVector2("windOffset", new Vector2(windX * time, windZ * time));
  }
}
