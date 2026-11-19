import { type BaseTexture, type Material, MaterialPluginBase, type Scene, Texture, type UniformBuffer } from "../babylon";

/**
 * Textured island terrain: texture splatting (the terrain shaders' blend of ground textures by
 * weights, here computed per pixel from height and slope as `island-geometry` colours its
 * vertices) with triplanar mapping for the rock (Geiss, "Generating complex procedural terrains",
 * GPU Gems 3 ch. 1: three planar projections blended by the normal, so cliff faces are not
 * smeared by a top-down projection). Grass and sand are projected from above, at two scales
 * blended to hide the tiling. The textures carry detail only: each is divided by its mean
 * brightness and multiplied into the vertex colour, so the palette of `island-geometry` (and its
 * tests) stays the land's colour. A material plugin on StandardMaterial: lights, shadows and fog
 * stay Babylon's own. Poly Haven, CC0: rock_face, aerial_grass_rock, sandy_gravel_02.
 */
export class TerrainSplat extends MaterialPluginBase {
  private readonly rock: Texture;
  private readonly grass: Texture;
  private readonly sand: Texture;

  constructor(material: Material, scene: Scene, texturesUrl: string, lite: boolean) {
    super(material, "TerrainSplat", 200, { TERRAIN_SPLAT: false });
    const tex = (id: string): Texture => {
      const t = new Texture(`${texturesUrl}${id}_diff${lite ? "-lite" : ""}.jpg`, scene);
      t.wrapU = t.wrapV = Texture.WRAP_ADDRESSMODE;
      return t;
    };
    this.rock = tex("rock_face");
    this.grass = tex("aerial_grass_rock");
    this.sand = tex("sandy_gravel_02");
    this._enable(true);
  }

  override getSamplers(samplers: string[]): void {
    samplers.push("splatRock", "splatGrass", "splatSand");
  }

  override getActiveTextures(active: BaseTexture[]): void {
    active.push(this.rock, this.grass, this.sand);
  }

  override bindForSubMesh(ubo: UniformBuffer): void {
    ubo.setTexture("splatRock", this.rock);
    ubo.setTexture("splatGrass", this.grass);
    ubo.setTexture("splatSand", this.sand);
  }

  override prepareDefines(defines: Record<string, unknown>): void {
    defines["TERRAIN_SPLAT"] = true;
  }

  override isReadyForSubMesh(): boolean {
    return this.rock.isReady() && this.grass.isReady() && this.sand.isReady();
  }

  override getClassName(): string {
    return "TerrainSplat";
  }

  override isCompatible(): boolean {
    return true;
  }

  override getCustomCode(shaderType: string): Record<string, string> | null {
    if (shaderType !== "fragment") return null;
    return {
      CUSTOM_FRAGMENT_DEFINITIONS: `
#ifdef TERRAIN_SPLAT
uniform sampler2D splatRock;
uniform sampler2D splatGrass;
uniform sampler2D splatSand;
// A texture as detail: its colour over its mean brightness (about 1 on average).
vec3 splatDetail(vec3 c, float mean) { return c / mean; }
// Two scales of a top-down projection, blended (the tiling of one hides under the other).
vec3 splatTop(sampler2D t, vec2 p, float scale) {
  return mix(texture2D(t, p / scale).rgb, texture2D(t, p / (scale * 3.7) + 0.31).rgb, 0.4);
}
#endif
`,
      CUSTOM_FRAGMENT_UPDATE_DIFFUSE: `
#ifdef TERRAIN_SPLAT
  {
    vec3 tn = normalize(vNormalW);
    vec3 tw = pow(abs(tn), vec3(4.0));
    tw /= (tw.x + tw.y + tw.z);
    vec3 rockC = texture2D(splatRock, vPositionW.zy / 9.0).rgb * tw.x
      + texture2D(splatRock, vPositionW.xz / 9.0).rgb * tw.y
      + texture2D(splatRock, vPositionW.xy / 9.0).rgb * tw.z;
    vec3 grassC = splatTop(splatGrass, vPositionW.xz, 24.0);
    vec3 sandC = splatTop(splatSand, vPositionW.xz, 5.0);
    // The same classes as island-geometry's colours: sand by the water, rock on the steep, ground above.
    float sandW = 1.0 - smoothstep(0.8, 2.2, vPositionW.y);
    float rockW = (1.0 - sandW) * smoothstep(0.75, 0.45, tn.y);
    float groundW = max(0.0, 1.0 - sandW - rockW);
    vec3 detail = splatDetail(rockC, 0.42) * rockW + splatDetail(grassC, 0.38) * groundW + splatDetail(sandC, 0.5) * sandW;
    baseColor.rgb *= clamp(detail, 0.0, 2.2);
  }
#endif
`,
    };
  }
}
