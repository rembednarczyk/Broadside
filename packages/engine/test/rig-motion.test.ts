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
    // A cantilever's curve: held upright at the step (hardly any movement low down), most of the
    // bow in the upper half, and no kink anywhere (the steps between equal heights keep growing).
    expect(bendShare(b, 8)).toBeLessThan(0.02);
    expect(bendShare(b, 24)).toBeCloseTo(0.3125, 4);
    let prev = 0;
    let prevStep = 0;
    for (let y = 5; y <= 44; y++) {
      const k = bendShare(b, y);
      expect(k - prev).toBeGreaterThanOrEqual(prevStep - 1e-9);
      prevStep = k - prev;
      prev = k;
    }
    // Above the head the line carries on at the end slope.
    expect(bendShare(b, 48)).toBeCloseTo(1.15, 4);
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
