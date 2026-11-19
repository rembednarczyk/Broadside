import { describe, expect, it } from "vitest";
import { DYNAMIC_RESOLUTION, DynamicResolution } from "../src/renderer/dynamic-resolution";

const run = (r: DynamicResolution, fps: number, seconds: number): number[] => {
  const changes: number[] = [];
  for (let t = 0; t < seconds; t += 1 / fps) {
    const s = r.update(1 / fps);
    if (s !== null) changes.push(s);
  }
  return changes;
};

describe("dynamic resolution", () => {
  it("leaves a game that keeps up alone", () => {
    const r = new DynamicResolution(1);
    expect(run(r, 60, 20)).toEqual([]);
    expect(run(r, 35, 20)).toEqual([]);
    expect(r.scale).toBe(1);
  });

  it("steps down in 5% steps, a pause apart, to the floor and no lower", () => {
    const r = new DynamicResolution(0.8);
    const first = run(r, 20, 3);
    expect(first[0]).toBe(0.75);
    expect(first.length).toBeLessThanOrEqual(2);
    run(r, 20, 60);
    expect(r.scale).toBeCloseTo(0.8 * DYNAMIC_RESOLUTION.floor);
  });

  it("climbs back to the player's own scale and never past it", () => {
    const r = new DynamicResolution(0.9);
    run(r, 15, 30);
    expect(r.scale).toBeLessThan(0.9);
    run(r, 60, 60);
    expect(r.scale).toBe(0.9);
  });

  it("ignores a pause (a tab in the background)", () => {
    const r = new DynamicResolution(1);
    for (let i = 0; i < 20; i++) expect(r.update(2)).toBeNull();
    expect(r.scale).toBe(1);
  });
});
