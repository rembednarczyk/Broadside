import { describe, expect, it } from "vitest";
import { coastline, generateArchipelago, islandHeight } from "../src";

describe("coastline", () => {
  const a = generateArchipelago(7);

  it("traces each island's waterline: the land just inside, the sea just outside", () => {
    for (const is of a.islands.slice(0, 8)) {
      const pts = coastline(is, 32);
      expect(pts).toHaveLength(32);
      for (const p of pts) {
        const dx = p.x - is.x;
        const dz = p.z - is.z;
        const d = Math.hypot(dx, dz);
        expect(islandHeight(is, is.x + (dx / d) * (d - 3), is.z + (dz / d) * (d - 3))).toBeGreaterThan(0);
        expect(islandHeight(is, is.x + (dx / d) * (d + 3), is.z + (dz / d) * (d + 3))).toBeLessThanOrEqual(0.05);
      }
    }
  });

  it("draws the shallows outside the waterline", () => {
    const is = a.islands[0]!;
    const coast = coastline(is, 24);
    const shoal = coastline(is, 24, -4);
    for (let i = 0; i < 24; i++) {
      expect(Math.hypot(shoal[i]!.x - is.x, shoal[i]!.z - is.z)).toBeGreaterThan(Math.hypot(coast[i]!.x - is.x, coast[i]!.z - is.z));
    }
  });
});
