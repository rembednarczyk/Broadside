import { describe, expect, it } from "vitest";
import { hangingRope, isParted, partsBelow, yardFallsBelow } from "../src/renderer/rope-cut";

describe("rigging shot away", () => {
  it("parts none of a sound rig, more as it is shot away, nearly all near the end", () => {
    const parted = (r: number) => Array.from({ length: 40 }, (_, i) => isParted(i, r)).filter(Boolean).length;
    expect(parted(1)).toBe(0);
    expect(parted(0.6)).toBeGreaterThan(5);
    expect(parted(0.6)).toBeLessThan(35);
    expect(parted(0.1)).toBe(40);
    // A rope once parted stays parted as the rigging worsens.
    for (let i = 0; i < 40; i++) if (isParted(i, 0.6)) expect(isParted(i, 0.4)).toBe(true);
    expect(partsBelow(3)).toBe(partsBelow(3));
  });

  it("hangs a parted rope from its upper end, the same number of points, above the floor", () => {
    const pts = hangingRope([0, 2, 0], [0, 30, 10], 3, 1.5, 1.5);
    expect(pts).toHaveLength(7);
    expect(pts[0]).toEqual([0, 30, 10]);
    expect(pts.every((p) => p[1] >= 1.5)).toBe(true);
    expect(pts[6]![1]).toBeLessThan(20);
  });
});

describe("yards shot down", () => {
  it("come down only when the rigging is in tatters, each at its own threshold", () => {
    const ts = Array.from({ length: 12 }, (_, k) => yardFallsBelow(k));
    expect(ts.every((t) => t >= 0.08 && t <= 0.42)).toBe(true);
    expect(new Set(ts.map((t) => t.toFixed(3))).size).toBeGreaterThan(6);
  });
});
