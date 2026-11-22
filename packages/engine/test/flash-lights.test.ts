import { describe, expect, it } from "vitest";
import { flicker } from "../src/effects/flash-lights";

describe("fire glow", () => {
  it("flickers between about half and full strength, never still", () => {
    const v = Array.from({ length: 600 }, (_, i) => flicker(i / 60));
    expect(Math.min(...v)).toBeGreaterThanOrEqual(0.55);
    expect(Math.max(...v)).toBeLessThanOrEqual(1);
    expect(Math.max(...v) - Math.min(...v)).toBeGreaterThan(0.25);
  });
});
