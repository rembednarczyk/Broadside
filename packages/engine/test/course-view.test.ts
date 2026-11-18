import { describe, expect, it } from "vitest";
import { ribbonOnWater } from "../src/renderer/course-view";

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
