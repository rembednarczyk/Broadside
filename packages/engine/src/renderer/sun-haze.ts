import { type Material, MaterialPluginBase, type UniformBuffer } from "../babylon";

/**
 * Sunlit haze over the land (aerial perspective with in-scattering, as the ocean shader does it:
 * Preetham's and Hoffman's daylight models light the airlight brighter towards the sun). Babylon's
 * own fog greys a distant island with one colour, so against a low sun the coast stood out dark
 * and sharp, where the reference frames (ref_152, ref_060) lose it in a bright mist. This plugin
 * adds the ocean's forward-scattering lobes (the same two powers, `towardSun`) times the share of
 * haze in front of the surface: Babylon's fog factor where the mesh is fogged, else a fixed share
 * (`haze`, the far coast's rings, drawn unfogged with their own airlight). A material plugin
 * (MaterialPluginBase) on StandardMaterial: lighting and shadows stay Babylon's own.
 */
export interface HazeSun {
  dir: { x: number; y: number; z: number };
  color: { r: number; g: number; b: number };
}

const suns = new WeakMap<object, HazeSun>();
/** The sun the haze of a scene glows towards: one per scene, updated by the renderer each frame. */
export const hazeSunOf = (scene: object): HazeSun => {
  let s = suns.get(scene);
  if (!s) {
    s = { dir: { x: 0, y: 1, z: 0 }, color: { r: 0, g: 0, b: 0 } };
    suns.set(scene, s);
  }
  return s;
};

export class SunHaze extends MaterialPluginBase {
  /** Share of haze in front of an unfogged mesh (the far coast); ignored where the scene's fog applies. */
  haze = 0;

  constructor(material: Material, private readonly sun: HazeSun) {
    super(material, "SunHaze", 210, { SUN_HAZE: false });
    this._enable(true);
  }

  override getUniforms(): { ubo: { name: string; size: number; type: string }[]; fragment: string } {
    return {
      ubo: [
        { name: "hazeSunDir", size: 3, type: "vec3" },
        { name: "hazeSunColor", size: 3, type: "vec3" },
        { name: "hazeShare", size: 1, type: "float" },
      ],
      fragment: "#ifdef SUN_HAZE\nuniform vec3 hazeSunDir;\nuniform vec3 hazeSunColor;\nuniform float hazeShare;\n#endif\n",
    };
  }

  override bindForSubMesh(ubo: UniformBuffer): void {
    const { dir: d, color: c } = this.sun;
    ubo.updateFloat3("hazeSunDir", d.x, d.y, d.z);
    ubo.updateFloat3("hazeSunColor", c.r, c.g, c.b);
    ubo.updateFloat("hazeShare", this.haze);
  }

  override prepareDefines(defines: Record<string, unknown>): void {
    defines["SUN_HAZE"] = true;
  }

  override getClassName(): string {
    return "SunHaze";
  }

  override isCompatible(): boolean {
    return true;
  }

  override getCustomCode(shaderType: string): Record<string, string> | null {
    if (shaderType !== "fragment") return null;
    return {
      CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR: `
#ifdef SUN_HAZE
  #ifdef FOG
    float hazeIn = 1.0 - fog;
  #else
    float hazeIn = hazeShare;
  #endif
  float hazeToward = max(dot(-viewDirectionW, hazeSunDir), 0.0);
  color.rgb += hazeSunColor * (pow(hazeToward, 3.0) * 0.55 + pow(hazeToward, 12.0) * 0.6) * hazeIn;
#endif
`,
    };
  }
}
