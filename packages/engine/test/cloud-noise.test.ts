import { describe, expect, it } from "vitest";
import { cloudNoiseVolume } from "../src/shaders/cloud-noise";

describe("cloud noise volume", () => {
  it("is deterministic and fills every channel", () => {
    const a = cloudNoiseVolume(16);
    const b = cloudNoiseVolume(16);
    expect(a.length).toBe(16 * 16 * 16 * 4);
    expect(Array.from(a)).toEqual(Array.from(b));
    for (let channel = 0; channel < 4; channel++) {
      let min = 255;
      let max = 0;
      for (let i = channel; i < a.length; i += 4) {
        min = Math.min(min, a[i] ?? 0);
        max = Math.max(max, a[i] ?? 0);
      }
      // Each channel uses a good part of its range (a flat channel would carve nothing).
      expect(max - min).toBeGreaterThan(100);
    }
  });

  it("tiles: opposite faces of the volume are neighbours like any two layers", () => {
    const n = 16;
    const v = cloudNoiseVolume(n);
    const at = (i: number, j: number, k: number, c: number): number => v[((k * n + j) * n + i) * 4 + c] ?? 0;
    let across = 0;
    let inside = 0;
    for (let j = 0; j < n; j++) {
      for (let k = 0; k < n; k++) {
        across += Math.abs(at(0, j, k, 0) - at(n - 1, j, k, 0));
        inside += Math.abs(at(7, j, k, 0) - at(8, j, k, 0));
      }
    }
    // The step over the seam is of the size of a step inside the volume, not a jump.
    expect(across).toBeLessThan(inside * 2);
  });
});
