import { describe, expect, it } from "vitest";
import { dragFactor, elevationFor, flatRange, impactEnergy, DAMAGE_PER_JOULE, shotRadius } from "../src/combat/ballistics";
import { MUZZLE_SPEED, shotMass } from "../src/data/ammo";
import { isHostile, startStanding } from "../src/data/factions";

describe("ballistics", () => {
  const m = shotMass(12, "round");
  const k = dragFactor(m);

  it("sizes iron shot: a 12-pounder is about 11 cm across", () => {
    expect(shotRadius(m) * 2).toBeGreaterThan(0.1);
    expect(shotRadius(m) * 2).toBeLessThan(0.13);
  });

  it("reaches a few hundred metres point blank and about a kilometre elevated", () => {
    expect(flatRange(MUZZLE_SPEED, 0, 2.5, k)).toBeGreaterThan(60);
    expect(flatRange(MUZZLE_SPEED, 0.12, 2.5, k)).toBeGreaterThan(250);
    expect(flatRange(MUZZLE_SPEED, 0.75, 2.5, k)).toBeGreaterThan(700);
  });

  it("finds the elevation for a range", () => {
    const e = elevationFor(300, MUZZLE_SPEED, 2.5, k, 0.3);
    expect(Math.abs(flatRange(MUZZLE_SPEED, e, 2.5, k) - 300)).toBeLessThan(2);
    expect(elevationFor(5000, MUZZLE_SPEED, 2.5, k, 0.3)).toBe(0.3);
    expect(elevationFor(1, MUZZLE_SPEED, 2.5, k, 0.3)).toBeCloseTo(-0.12);
  });

  it("makes a muzzle-speed 12-pounder worth about 13 hit points", () => {
    expect(impactEnergy(m, MUZZLE_SPEED) * DAMAGE_PER_JOULE).toBeGreaterThan(11);
    expect(impactEnergy(m, MUZZLE_SPEED) * DAMAGE_PER_JOULE).toBeLessThan(15);
  });
});

describe("factions", () => {
  it("makes pirates hostile to all and friends of themselves", () => {
    expect(isHostile(startStanding("pirates", "crown"))).toBe(true);
    expect(isHostile(startStanding("pirates", "pirates"))).toBe(false);
    expect(isHostile(startStanding("crown", "republic"))).toBe(true);
    expect(isHostile(startStanding("player", "crown"))).toBe(false);
  });
});
