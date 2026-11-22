import { describe, expect, it } from "vitest";
import { particleLight } from "../src/effects/particle-light";
import { sceneLook } from "../src/renderer/look";

const mean = (l: { r: number; g: number; b: number }) => (l.r + l.g + l.b) / 3;

describe("light on unlit particles", () => {
  it("leaves the afternoon colours as tuned", () => {
    const l = particleLight(sceneLook(14, 0.55, 0));
    expect(l.r).toBeCloseTo(1, 6);
    expect(l.b).toBeCloseTo(1, 6);
  });

  it("darkens smoke at night to a small part of the day", () => {
    expect(mean(particleLight(sceneLook(23, 0.55, 0)))).toBeLessThan(0.45);
    expect(mean(particleLight(sceneLook(2, 0.55, 0)))).toBeGreaterThan(0.02);
  });

  it("is bluer by moonlight than by day", () => {
    const night = particleLight(sceneLook(23, 0.55, 0));
    expect(night.b / night.r).toBeGreaterThan(1.05);
  });
});
