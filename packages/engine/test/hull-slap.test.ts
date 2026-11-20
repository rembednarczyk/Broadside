import { describe, expect, it } from "vitest";
import { makeWave, quatFromAxisAngle, vec3 } from "@broadside/core";
import { hullSlaps } from "../src/effects/hull-slap";

const hull = (vy: number, y = 0, roll = 0) => ({ pos: vec3(0, y, 0), rot: quatFromAxisAngle(vec3(0, 0, 1), roll), pointVelocity: () => vec3(0, vy, 0), length: 40, beam: 11, waterline: 0 });

describe("hull slaps", () => {
  it("throw nothing on a calm sea from a hull at rest", () => {
    expect(hullSlaps(hull(0), [], 0)).toHaveLength(0);
  });

  it("burst along both sides when the hull drives down into the water", () => {
    const hits = hullSlaps(hull(-4), [], 0);
    expect(hits.length).toBe(10);
    expect(hits.every((h) => h.strength > 2)).toBe(true);
    expect(new Set(hits.map((h) => Math.sign(h.nx)))).toEqual(new Set([-1, 1]));
  });

  it("throw nothing from a side lifted clear of the sea", () => {
    expect(hullSlaps(hull(-4, 3), [], 0)).toHaveLength(0);
  });

  it("follow a wave rising against a hull at rest", () => {
    const waves = [makeWave(0, 30, 1.5, 0.7, 0, 1)];
    const counts = [0, 1, 2, 3, 4, 5].map((t) => hullSlaps(hull(0), waves, t).length);
    expect(Math.max(...counts)).toBeGreaterThan(0);
  });
});
