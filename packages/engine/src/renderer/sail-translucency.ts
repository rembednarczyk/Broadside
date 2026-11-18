import { type Material, MaterialPluginBase, type UniformBuffer } from "../babylon";

/**
 * Canvas lit from behind: a thin sheet passes some of the light that falls on its far side, so a
 * sail between the camera and the sun glows through (ref_124, ref_090: the dark sails go amber
 * where the sun stands behind them). The thin-surface translucency of foliage in real-time
 * renderers (Sousa, "Vegetation Procedural Animation and Shading in Crysis", GPU Gems 3 ch. 16):
 * light through the back face, N·(−L) on the side seen, with a forward-scattering lobe towards
 * the light. Our difference: no thickness map (canvas is even), and the lobe is a power of
 * −V·L instead of a texture lookup. No shadow: a sail shaded by another sail glows as well (cheap,
 * and the panes of a rig rarely line up with the sun). Added to StandardMaterial as a material
 * plugin (Babylon's MaterialPluginBase, injected before the final colour).
 */
export interface SailLight {
  /** Unit vector towards the key light (the sun, or the moon at night). */
  dir: { x: number; y: number; z: number };
  /** Colour of the key light times its intensity and the canvas's transmittance. */
  color: { r: number; g: number; b: number };
}

/** Share of the light on a sail's far side that comes through the canvas. */
export const SAIL_TRANSMITTANCE = 0.07;

export class SailTranslucency extends MaterialPluginBase {
  private readonly light: SailLight;

  constructor(material: Material, light: SailLight) {
    super(material, "SailTranslucency", 210, { SAIL_TRANSLUCENCY: false });
    this.light = light;
    this._enable(true);
  }

  override prepareDefines(defines: Record<string, unknown>): void {
    defines["SAIL_TRANSLUCENCY"] = true;
  }

  override getClassName(): string {
    return "SailTranslucency";
  }

  override isCompatible(): boolean {
    return true;
  }

  override getUniforms(): { ubo: { name: string; size: number; type: string }[]; fragment: string } {
    return {
      ubo: [
        { name: "sailLightDir", size: 3, type: "vec3" },
        { name: "sailLightColor", size: 3, type: "vec3" },
      ],
      fragment: "#ifdef SAIL_TRANSLUCENCY\nuniform vec3 sailLightDir;\nuniform vec3 sailLightColor;\n#endif\n",
    };
  }

  override bindForSubMesh(ubo: UniformBuffer): void {
    const { dir, color } = this.light;
    ubo.updateFloat3("sailLightDir", dir.x, dir.y, dir.z);
    ubo.updateFloat3("sailLightColor", color.r, color.g, color.b);
  }

  override getCustomCode(shaderType: string): Record<string, string> | null {
    if (shaderType !== "fragment") return null;
    return {
      // normalW faces the camera on both sides (two-sided lighting): light from behind is −N·L.
      CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR: `
#ifdef SAIL_TRANSLUCENCY
  float sailThrough = max(dot(-normalW, sailLightDir), 0.0);
  float sailLobe = pow(max(dot(-viewDirectionW, sailLightDir), 0.0), 4.0);
  color.rgb += baseColor.rgb * sailLightColor * sailThrough * (0.1 + 0.9 * sailLobe);
#endif
`,
    };
  }
}

/** The key light of a scene as the sails see it: one per scene, updated by the renderer each frame. */
const lights = new WeakMap<object, SailLight>();
export const sailLightOf = (scene: object): SailLight => {
  let l = lights.get(scene);
  if (!l) {
    l = { dir: { x: 0, y: 1, z: 0 }, color: { r: 0, g: 0, b: 0 } };
    lights.set(scene, l);
  }
  return l;
};
