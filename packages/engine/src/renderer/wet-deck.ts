import { type Material, MaterialPluginBase } from "../babylon";

/**
 * A wet deck on the hulls from models: the faces that look up (the deck, the tops of the rails and
 * hatches) take a tight, bright sheen, the sides stay matt, so the low sun throws patches of light
 * off the planking (ref_112) while the hull's sides do not turn to plastic. The scanned models have
 * one material for deck and sides alike, hence a per-pixel choice by the normal: the Blinn-Phong
 * specular of StandardMaterial with its colour and glossiness raised where the normal is near
 * vertical (a "slope mask" as terrain shaders use to put snow or moss on the flat). The lights,
 * their shadows included, stay Babylon's own: the plugin only swaps the specular uniform for a
 * local value before the light loop reads it (a material plugin, MaterialPluginBase).
 */
export class WetDeck extends MaterialPluginBase {
  constructor(material: Material) {
    super(material, "WetDeck", 205, { WET_DECK: false });
    this._enable(true);
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
    };
  }
}
