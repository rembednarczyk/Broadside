import { describe, expect, it } from "vitest";
import { coastHaze, coastHeights } from "../src/renderer/far-coast";

describe("far coast", () => {
  it("has flat-topped headlands with gaps of open sea between them", () => {
    const h = coastHeights(7);
    expect(h.some((x) => x === 0)).toBe(true);
    expect(Math.max(...h)).toBeGreaterThan(100);
  });

  it("pales with distance and with the fog, never quite to the fog's colour", () => {
    expect(coastHaze(3800, 0.0014)).toBeGreaterThan(coastHaze(2600, 0.0014));
    expect(coastHaze(2600, 0.003)).toBeGreaterThan(coastHaze(2600, 0.0006));
    expect(coastHaze(3800, 0.01)).toBeLessThanOrEqual(0.97);
  });
});
