/**
 * Graphics quality: presets and the individual settings they set (the usual PC game options
 * model: a preset fills every field, the player may then change single fields, which turns the
 * preset into "custom"). Pure data, shared by the renderer and the settings screen.
 */
export type GraphicsPreset = "low" | "medium" | "high" | "ultra" | "cinematic";
export const GRAPHICS_PRESETS: readonly GraphicsPreset[] = ["low", "medium", "high", "ultra", "cinematic"];

/** Colour treatment of the final image: a style choice, independent of the quality preset. */
export type ColorMode = "sepia" | "natural" | "vibrant";
export const COLOR_MODES: readonly ColorMode[] = ["sepia", "natural", "vibrant"];

export interface GraphicsSettings {
  readonly preset: GraphicsPreset | "custom";
  readonly colorMode: ColorMode;
  /** Share of the device pixel ratio rendered (0.5..1). */
  readonly renderScale: number;
  /** Multisample anti-aliasing samples of the post pipeline (1 = off). */
  readonly msaa: 1 | 2 | 4;
  /** Shadow map size; 0 disables shadows. */
  readonly shadowSize: 0 | 1024 | 2048 | 4096;
  /** Cascaded shadow maps (sharper near, wider range). */
  readonly cascades: boolean;
  /** Ocean grid cells per side (vertex density). */
  readonly oceanCells: number;
  /** Extra visual-only short waves on top of the simulated sea (0, 4 or 8). */
  readonly detailWaves: 0 | 4 | 8;
  /** Octaves of cloud noise. */
  readonly cloudOctaves: 3 | 4 | 5 | 6;
  /** Samples of the sun shafts; 0 disables them. */
  readonly sunShafts: number;
  readonly bloom: boolean;
  readonly ssao: boolean;
  readonly motionBlur: boolean;
  /** Lens droplets, underwater wobble, lightning flash. */
  readonly lens: boolean;
  /** Particle budget multiplier. */
  readonly particles: number;
}

const BASE: Readonly<Record<GraphicsPreset, Omit<GraphicsSettings, "preset" | "colorMode">>> = {
  low: { renderScale: 0.6, msaa: 1, shadowSize: 0, cascades: false, oceanCells: 120, detailWaves: 0, cloudOctaves: 3, sunShafts: 0, bloom: false, ssao: false, motionBlur: false, lens: false, particles: 0.4 },
  medium: { renderScale: 0.75, msaa: 1, shadowSize: 1024, cascades: false, oceanCells: 180, detailWaves: 0, cloudOctaves: 4, sunShafts: 30, bloom: true, ssao: false, motionBlur: false, lens: true, particles: 0.7 },
  high: { renderScale: 1, msaa: 2, shadowSize: 2048, cascades: false, oceanCells: 240, detailWaves: 4, cloudOctaves: 6, sunShafts: 60, bloom: true, ssao: false, motionBlur: false, lens: true, particles: 1 },
  ultra: { renderScale: 1, msaa: 4, shadowSize: 4096, cascades: true, oceanCells: 360, detailWaves: 8, cloudOctaves: 6, sunShafts: 90, bloom: true, ssao: true, motionBlur: true, lens: true, particles: 1.3 },
  cinematic: { renderScale: 1, msaa: 4, shadowSize: 4096, cascades: true, oceanCells: 480, detailWaves: 8, cloudOctaves: 6, sunShafts: 120, bloom: true, ssao: true, motionBlur: true, lens: true, particles: 1.6 },
};

export const presetSettings = (p: GraphicsPreset, colorMode: ColorMode = "sepia"): GraphicsSettings => ({ preset: p, colorMode, ...BASE[p] });

/** Changes one field; the result is "custom" unless it still equals a preset exactly. */
export const withSetting = <K extends keyof Omit<GraphicsSettings, "preset" | "colorMode">>(s: GraphicsSettings, key: K, value: GraphicsSettings[K]): GraphicsSettings => {
  const next = { ...s, [key]: value };
  const match = GRAPHICS_PRESETS.find((p) => (Object.keys(BASE[p]) as (keyof typeof BASE.low)[]).every((k) => BASE[p][k] === next[k]));
  return { ...next, preset: match ?? "custom" };
};

/** Default for a device: touch devices start at medium, others at high. */
export const defaultGraphics = (touch: boolean): GraphicsSettings => presetSettings(touch ? "medium" : "high");

/** Parses stored settings, falling back to the default on anything unexpected. */
export const parseGraphics = (text: string | null, touch: boolean): GraphicsSettings => {
  if (!text) return defaultGraphics(touch);
  try {
    const raw = JSON.parse(text) as Partial<GraphicsSettings>;
    const base = defaultGraphics(touch);
    const merged = { ...base, ...raw } as GraphicsSettings;
    const colorMode = COLOR_MODES.includes(merged.colorMode) ? merged.colorMode : "sepia";
    return typeof merged.renderScale === "number" && typeof merged.oceanCells === "number" ? { ...merged, colorMode } : base;
  } catch {
    return defaultGraphics(touch);
  }
};
