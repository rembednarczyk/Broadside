import { describe, expect, it } from "vitest";
import { sailForce, liftCoefficient, POLARS, driveWind, NO_GO } from "../src/sailing/aero";
import { apparentWind, beaufort, windVector, angleOffWind } from "../src/sailing/wind";
import { DEG } from "../src/math/scalar";

/** Wind blowing towards a body-space direction (0 = towards the bow). */
const aw = (towards: number, speed: number) => ({ x: Math.sin(towards) * speed, z: Math.cos(towards) * speed });

describe("sail force", () => {
  it("drives forward on a beam reach, for both rigs", () => {
    const w = aw(-Math.PI / 2, 10); // wind from starboard, blowing to port
    for (const rig of ["square", "foreAft"] as const) {
      const f = sailForce(rig, 100, w.x, w.z, 1);
      expect(f.fz).toBeGreaterThan(0);
      expect(f.fx).toBeLessThan(0); // heels and pushes to leeward
    }
  });

  it("lets a fore-and-aft rig point higher than a square rig", () => {
    // Apparent wind 40 deg off the bow from starboard: it blows towards 180+40 deg.
    const w = aw(Math.PI + 40 * DEG, 10);
    const square = sailForce("square", 100, w.x, w.z, 1).fz;
    const foreAft = sailForce("foreAft", 100, w.x, w.z, 1).fz;
    expect(foreAft).toBeGreaterThan(0);
    expect(foreAft).toBeGreaterThan(square);
  });

  it("drives a square rig well when running", () => {
    const w = aw(0, 10);
    expect(sailForce("square", 100, w.x, w.z, 1).fz).toBeGreaterThan(sailForce("foreAft", 100, w.x, w.z, 1).fz * 0.9);
  });

  it("loses drive with a poor crew and gives nothing in a calm", () => {
    const w = aw(-Math.PI / 2, 10);
    expect(sailForce("foreAft", 100, w.x, w.z, 0).fz).toBeLessThan(sailForce("foreAft", 100, w.x, w.z, 1).fz);
    expect(sailForce("foreAft", 100, 0, 0, 1).fz).toBe(0);
  });

  it("stalls past the maximum lift angle", () => {
    const p = POLARS.foreAft;
    expect(liftCoefficient(p, p.alphaMax)).toBeCloseTo(p.clMax, 6);
    expect(liftCoefficient(p, 60 * DEG)).toBeLessThan(p.clMax);
    expect(liftCoefficient(p, 1 * DEG)).toBe(0);
  });
});

describe("wind", () => {
  it("subtracts the ship's motion", () => {
    const a = apparentWind(windVector(0, 10), 0, 4);
    expect(a.z).toBeCloseTo(6);
  });
  it("names the force", () => {
    expect(beaufort(0.2)).toBe(0);
    expect(beaufort(9)).toBe(5);
    expect(beaufort(40)).toBe(12);
  });
  it("measures the angle off the wind", () => {
    expect(angleOffWind(0, 0)).toBe(0);
    expect(angleOffWind(Math.PI, 0)).toBeCloseTo(Math.PI);
    expect(angleOffWind(-3, 3)).toBeCloseTo(2 * Math.PI - 6);
  });
});

describe("assisted ships never sail aback (owner's report 22.11)", () => {
  it("turns a wind from ahead out to the edge of the no-go arc, and leaves a free wind alone", () => {
    // Dead ahead: the air moves aft (-z).
    const ahead = driveWind(0, -8);
    expect(Math.hypot(ahead.x, ahead.z)).toBeCloseTo(8);
    expect(Math.abs(Math.atan2(-ahead.x, -ahead.z))).toBeCloseTo(NO_GO);
    // From 20 deg on the port bow: out to 60 deg on the same side.
    const port = driveWind(Math.sin(20 * Math.PI / 180) * 5, -Math.cos(20 * Math.PI / 180) * 5);
    expect(Math.atan2(-port.x, -port.z)).toBeCloseTo(-NO_GO);
    // A beam wind is untouched.
    expect(driveWind(-6, 0)).toEqual({ x: -6, z: 0 });
  });
});
