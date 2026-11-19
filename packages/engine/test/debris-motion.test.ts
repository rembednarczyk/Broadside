import { describe, expect, it } from "vitest";
import { rollOf, pitchOf } from "@broadside/core";
import { DEBRIS, DebrisPool } from "../src/effects/debris-motion";

const flat = () => 0;

describe("plank debris", () => {
  it("throws planks up and out from the side, the same planks for the same hit", () => {
    const a = new DebrisPool(64);
    const b = new DebrisPool(64);
    a.burst(10, 3, 0, 1, 0, 8, 0);
    b.burst(10, 3, 0, 1, 0, 8, 0);
    expect(a.pieces).toHaveLength(8);
    expect(a.pieces).toEqual(b.pieces);
    expect(a.pieces.every((p) => p.vy > 0 && p.vx > -2)).toBe(true);
    expect(a.pieces.reduce((s, p) => s + p.vx, 0)).toBeGreaterThan(0);
  });

  it("falls into the sea with a splash, floats flat, drifts to a stop and is gone at the end of its life", () => {
    const pool = new DebrisPool(64);
    pool.burst(0, 3, 0, 0, 1, 4, 0);
    let splashes = 0;
    for (let i = 0; i < 60 * 6; i++) pool.step(1 / 60, flat, () => splashes++);
    expect(splashes).toBe(4);
    for (const p of pool.pieces) {
      expect(p.afloat).toBe(true);
      expect(Math.abs(p.y - 0.04)).toBeLessThan(0.01);
      expect(Math.abs(rollOf(p.rot)) + Math.abs(pitchOf(p.rot))).toBeLessThan(0.1);
      expect(Math.hypot(p.vx, p.vz)).toBeLessThan(0.5);
    }
    for (let i = 0; i < 60 * DEBRIS.life * 1.3; i++) pool.step(1 / 60, flat);
    expect(pool.pieces).toHaveLength(0);
  });

  it("keeps to its capacity, the oldest giving way", () => {
    const pool = new DebrisPool(10);
    pool.burst(0, 3, 0, 1, 0, 8, 0);
    pool.burst(50, 3, 0, 1, 0, 8, 1);
    expect(pool.pieces).toHaveLength(10);
    expect(pool.pieces.filter((p) => p.kind === 1)).toHaveLength(8);
  });
});
