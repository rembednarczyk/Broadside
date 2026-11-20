import { describe, expect, it } from "vitest";
import { GRAPHICS_PRESETS, defaultGraphics, parseGraphics, presetSettings, withSetting } from "../src/graphics-settings";

describe("graphics settings", () => {
  it("grows in cost from low to cinematic", () => {
    const cells = GRAPHICS_PRESETS.map((p) => presetSettings(p).oceanCells);
    expect(cells).toEqual([...cells].sort((a, b) => a - b));
    expect(presetSettings("low").shadowSize).toBe(0);
    expect(presetSettings("ultra").cascades).toBe(true);
  });

  it("turns a changed preset into custom, and back when it matches again", () => {
    const high = presetSettings("high");
    const changed = withSetting(high, "msaa", 4);
    expect(changed.preset).toBe("custom");
    expect(withSetting(changed, "msaa", 2).preset).toBe("high");
  });

  it("keeps the preset when only the resolution changes", () => {
    const ultra = withSetting(presetSettings("ultra"), "renderScale", 0.8);
    expect(ultra.preset).toBe("ultra");
    expect(ultra.renderScale).toBe(0.8);
    expect(ultra.skyScale).toBe(0.35);
  });

  it("defaults by device and survives bad storage", () => {
    expect(defaultGraphics(true).preset).toBe("medium");
    expect(defaultGraphics(false).preset).toBe("high");
    expect(parseGraphics("{not json", false).preset).toBe("high");
    expect(parseGraphics(JSON.stringify(presetSettings("ultra")), true).preset).toBe("ultra");
  });
});

describe("colour modes", () => {
  it("keep the colour mode across presets and fall back to sepia on bad data", () => {
    expect(presetSettings("ultra", "vibrant").colorMode).toBe("vibrant");
    expect(withSetting(presetSettings("high", "natural"), "bloom", false).colorMode).toBe("natural");
    expect(parseGraphics(JSON.stringify({ ...presetSettings("high"), colorMode: "neon" }), false).colorMode).toBe("sepia");
  });
});
