import { describe, expect, it } from "vitest";
import { type Island } from "@broadside/core";
import { cliffProfile } from "../src/renderer/island-geometry";

const island = (kind: Island["kind"]): Island => ({ id: 1, x: 0, z: 0, radius: 300, height: 60, kind, seed: 3, shoal: 80 });

describe("cliff profile", () => {
  it("keeps the waterline, the beach and the summit where the simulation has them", () => {
    const is = island("cliff");
    expect(cliffProfile(is, 0)).toBe(0);
    expect(cliffProfile(is, -5)).toBe(-5);
    expect(cliffProfile(is, 0.5)).toBe(0.5);
    expect(cliffProfile(is, 60)).toBeCloseTo(60);
  });

  it("rises steeply above the beach and flattens towards the top, more on cliff islands", () => {
    const cliff = island("cliff");
    const hill = island("jungle");
    let last = 0.8;
    for (let y = 1; y <= 60; y += 1) {
      const v = cliffProfile(cliff, y);
      expect(v).toBeGreaterThanOrEqual(last);
      last = v;
    }
    expect(cliffProfile(cliff, 5)).toBeGreaterThan(cliffProfile(hill, 5));
    expect(cliffProfile(hill, 5)).toBeGreaterThan(5);
  });
});
