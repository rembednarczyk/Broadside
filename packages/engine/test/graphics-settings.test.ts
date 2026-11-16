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
    const changed = withSetting(high, "renderScale", 0.8);
    expect(changed.preset).toBe("custom");
    expect(withSetting(changed, "renderScale", 1).preset).toBe("high");
  });

  it("defaults by device and survives bad storage", () => {
    expect(defaultGraphics(true).preset).toBe("medium");
    expect(defaultGraphics(false).preset).toBe("high");
    expect(parseGraphics("{not json", false).preset).toBe("high");
    expect(parseGraphics(JSON.stringify(presetSettings("ultra")), true).preset).toBe("ultra");
  });
});
