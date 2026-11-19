import { describe, expect, it } from "vitest";
import { backdropMask, coastHaze, coastHeights, coastRing } from "../src/renderer/far-coast";

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

  it("has a top running back from the cliff's edge, lower behind it, and shading within its haze", () => {
    const heights = coastHeights(7);
    const g = coastRing(heights, 2600, 1, 7);
    expect(g.colors.length / 4).toBe(g.positions.length / 3);
    for (const i of g.indices) expect(i).toBeLessThan(g.positions.length / 3);
    const top = heights.indexOf(Math.max(...heights));
    // Four rows per step: the foot, the edge, the top behind it and the fall beyond.
    const y = (row: number) => g.positions[(top * 4 + row) * 3 + 1]!;
    const dist = (row: number) => Math.hypot(g.positions[(top * 4 + row) * 3]!, g.positions[(top * 4 + row) * 3 + 2]!);
    expect(y(0)).toBeLessThan(0);
    expect(y(1)).toBeCloseTo(heights[top]!);
    expect(y(2)).toBeLessThan(y(1));
    expect(y(3)).toBeLessThan(y(2));
    expect(dist(3)).toBeGreaterThan(dist(2));
    expect(dist(2)).toBeGreaterThan(dist(1));
    for (const c of g.colors) expect(c).toBeLessThanOrEqual(1.06);
    expect(Math.min(...g.colors)).toBeGreaterThan(0.5);
  });

  it("leaves the mainland's side of the horizon to the drawn coast", () => {
    const east = Math.PI / 2;
    const h = coastHeights(7, east);
    const at = (bearing: number) => h[Math.round(((bearing / (Math.PI * 2)) * h.length + h.length) % h.length)]!;
    expect(at(east)).toBe(0);
    expect(at(east + 0.9)).toBe(0);
    expect(backdropMask(east + Math.PI, east)).toBe(1);
    expect(backdropMask(east, null)).toBe(1);
    expect(coastHeights(7, null)).toEqual(coastHeights(7));
  });
});
