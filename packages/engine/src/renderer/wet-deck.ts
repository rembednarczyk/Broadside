import { type Material, MaterialPluginBase, type UniformBuffer } from "../babylon";

/**
 * A wet deck on the hulls from models: the faces that look up (the deck, the tops of the rails and
 * hatches) take a tight, bright sheen, the sides stay matt, so the low sun throws patches of light
 * off the planking (ref_112) while the hull's sides do not turn to plastic. The scanned models have
 * one material for deck and sides alike, hence a per-pixel choice by the normal: the Blinn-Phong
 * specular of StandardMaterial with its colour and glossiness raised where the normal is near
 * vertical (a "slope mask" as terrain shaders use to put snow or moss on the flat). The lights,
 * their shadows included, stay Babylon's own: the plugin only swaps the specular uniform for a
 * local value before the light loop reads it (a material plugin, MaterialPluginBase).
 *
 * A wet deck also mirrors the sky, and that light is not stopped by the shadow of the sails: seen
 * along the planking (the deck camera, ref_112) the film of water reflects the bright sky ahead by
 * Schlick's Fresnel term with water's F0 of 0.02, the sky's colour from the reflected ray's height
 * (horizon to zenith, the sky dome's own gradient). No reflection probe: the planking's relief and
 * the darkness of overhangs are not in it.
 */
export interface WetSky {
  horizon: { r: number; g: number; b: number };
  zenith: { r: number; g: number; b: number };
}

/** The sky the decks of a scene mirror: one per scene, updated by the renderer each frame. */
const skies = new WeakMap<object, WetSky>();
export const wetSkyOf = (scene: object): WetSky => {
  let s = skies.get(scene);
  if (!s) {
    s = { horizon: { r: 0, g: 0, b: 0 }, zenith: { r: 0, g: 0, b: 0 } };
    skies.set(scene, s);
  }
  return s;
};

export class WetDeck extends MaterialPluginBase {
  private readonly sky: WetSky;

  constructor(material: Material, sky: WetSky) {
    super(material, "WetDeck", 205, { WET_DECK: false });
    this.sky = sky;
    this._enable(true);
  }

  override getUniforms(): { ubo: { name: string; size: number; type: string }[]; fragment: string } {
    return {
      ubo: [
        { name: "wetHorizon", size: 3, type: "vec3" },
        { name: "wetZenith", size: 3, type: "vec3" },
      ],
      fragment: "#ifdef WET_DECK\nuniform vec3 wetHorizon;\nuniform vec3 wetZenith;\n#endif\n",
    };
  }

  override bindForSubMesh(ubo: UniformBuffer): void {
    const { horizon: h, zenith: z } = this.sky;
    ubo.updateFloat3("wetHorizon", h.r, h.g, h.b);
    ubo.updateFloat3("wetZenith", z.r, z.g, z.b);
  }

  override prepareDefines(defines: Record<string, unknown>): void {
    defines["WET_DECK"] = true;
  }

  override getClassName(): string {
    return "WetDeck";
  }

  override isCompatible(): boolean {
    return true;
  }

  override getCustomCode(shaderType: string): Record<string, string> | null {
    if (shaderType !== "fragment") return null;
    return {
      // vSpecularColor is read right after this point (colour and glossiness): from here on the
      // name stands for the wet value.
      CUSTOM_FRAGMENT_BEFORE_LIGHTS: `
#ifdef WET_DECK
  float wetTop = smoothstep(0.72, 0.93, normalW.y);
  vec4 wetSpecular = mix(vSpecularColor, vec4(0.6, 0.57, 0.52, 32.0), wetTop);
  #define vSpecularColor wetSpecular
#endif
`,
      CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR: `
#ifdef WET_DECK
  vec3 wetRay = reflect(-viewDirectionW, normalW);
  float wetFresnel = 0.02 + 0.98 * pow(1.0 - clamp(dot(normalW, viewDirectionW), 0.0, 1.0), 5.0);
  color.rgb += mix(wetHorizon, wetZenith, sqrt(clamp(wetRay.y, 0.0, 1.0))) * wetFresnel * wetTop;
#endif
`,
    };
  }
}
