import { describe, expect, it } from "vitest";
import { MastSprings, bendShare, flutterOffset, sagLine } from "../src/renderer/rig-motion";

describe("rig motion", () => {
  it("bends a loaded mast to leeward and forward, overshooting and settling", () => {
    const s = new MastSprings([{ base: 4, height: 40 }]);
    let peak = 0;
    let last = s.update(1 / 60, [1], 1, 0.6)[0]!;
    for (let i = 0; i < 60 * 12; i++) {
      last = s.update(1 / 60, [1], 1, 0.6)[0]!;
      peak = Math.max(peak, last.dx);
    }
    expect(last.dx).toBeGreaterThan(1);
    expect(last.dz).toBeGreaterThan(0);
    expect(peak).toBeGreaterThan(last.dx * 1.1);
    const idle = new MastSprings([{ base: 4, height: 40 }]);
    expect(idle.update(1 / 60, [0], 1, 0.6)[0]!.dx).toBe(0);
  });

  it("moves points with their height above the step", () => {
    const b = { dx: 1, dz: 0, base: 4, height: 40 };
    expect(bendShare(b, 4)).toBe(0);
    expect(bendShare(b, 44)).toBeCloseTo(1);
    expect(bendShare(b, 0)).toBe(0);
  });

  it("sags a stay between fixed ends", () => {
    const pts = sagLine([0, 10, 0], [0, 10, 20], 1, 6);
    expect(pts[0]).toEqual([0, 10, 0]);
    expect(pts[6]).toEqual([0, 10, 20]);
    expect(pts[3]![1]).toBeCloseTo(9);
  });

  it("shakes the leech, not the luff", () => {
    expect(Math.abs(flutterOffset(1, 10, 0, 0.5, 3))).toBe(0);
    expect(Math.abs(flutterOffset(1, 10, 1, 0.5, 0.1))).toBeGreaterThan(0);
  });
});
