import { describe, expect, it } from "vitest";
import { laylines, noGoFan, ribbonOnWater } from "../src/renderer/course-view";

describe("course drawn on the water", () => {
  it("lays a strip of the given width along the line, riding the surface", () => {
    const line = [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 20, z: 10 }];
    const r = ribbonOnWater(line, 2, (x) => x * 0.1);
    expect(r.positions).toHaveLength(line.length * 2 * 3);
    expect(r.indices).toHaveLength((line.length - 1) * 6);
    // Across the first point: 1 m either side, at the height of the surface there.
    expect(Math.hypot(r.positions[0]! - r.positions[3]!, r.positions[2]! - r.positions[5]!)).toBeCloseTo(2);
    expect(r.positions[1]).toBeCloseTo(r.positions[0]! * 0.1);
    expect(ribbonOnWater([{ x: 0, z: 0 }], 2, () => 0).indices).toHaveLength(0);
  });
});

describe("what the wind allows, on the water", () => {
  it("fans the no-go zone round the wind's eye and lays the two close-hauled tracks back from a point to windward", () => {
    const fan = noGoFan({ x: 0, z: 0 }, 0, Math.PI / 4, 50, () => 0, 8);
    expect(fan.indices).toHaveLength(8 * 3);
    // The middle of the fan points into the wind (here +z), 50 m out.
    expect(fan.positions[3 * 5]).toBeCloseTo(0);
    expect(fan.positions[3 * 5 + 2]).toBeCloseTo(50);
    const [a, b] = laylines({ x: 0, z: 100 }, 0, Math.PI / 4, 100);
    // Both lie downwind of the point, one each side.
    expect(a![0]!.z).toBeLessThan(100);
    expect(Math.sign(a![0]!.x)).toBe(-Math.sign(b![0]!.x));
  });
});
