import { describe, expect, it } from "vitest";
import { chartedBed } from "../src/ai/pilot/plan";

describe("the charted seabed", () => {
  it("is the real one inside the sea, a bar at its edge", () => {
    const bed = chartedBed(4000, () => -60);
    expect(bed(0, 0)).toBe(-60);
    expect(bed(3800, -3800)).toBe(-60);
    expect(bed(3900, 0)).toBe(0);
    expect(bed(0, -4100)).toBe(0);
  });
});
