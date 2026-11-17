import { describe, expect, it } from "vitest";
import { AMMO, AMMO_IDS, canFire, reloadSeconds, shotMass } from "../src/data/ammo";
import { SHIP_CLASSES, SHIP_CLASS_IDS } from "../src/data/ship-classes";
import { EventQueue } from "../src/events/events";
import { vec3, add, sub, scale, dot, cross, length, lengthSq, distance, normalize, mulv, isFiniteVec, lengthXZ, addScaled, ZERO } from "../src/math/vec3";
import { clamp01, lerp, smoothstep } from "../src/math/scalar";
import { noise1, seedOf } from "../src/math/noise";
import { createRng, range } from "../src/math/rng";
import { waterVerticalSpeed, makeWave } from "../src/ocean/gerstner";

describe("ammunition table", () => {
  it("fits its mounts and has sane multipliers", () => {
    for (const id of AMMO_IDS) {
      const a = AMMO[id];
      expect(a.pellets, id).toBeGreaterThanOrEqual(1);
      expect(a.price, id).toBeGreaterThan(0);
    }
    expect(canFire("chain", "broadside")).toBe(true);
    expect(canFire("shell", "broadside")).toBe(false);
    expect(canFire("grape", "swivel")).toBe(true);
  });

  it("reloads bigger guns and heavier loads slower, faster with a full crew", () => {
    expect(reloadSeconds(32, "round", 1)).toBeGreaterThan(reloadSeconds(6, "round", 1));
    expect(reloadSeconds(12, "heavy", 1)).toBeGreaterThan(reloadSeconds(12, "round", 1));
    expect(reloadSeconds(12, "round", 0.5)).toBeGreaterThan(reloadSeconds(12, "round", 1));
    expect(shotMass(12, "round")).toBeCloseTo(5.44, 2);
  });

  it("gives every class guns, masts and crew", () => {
    for (const id of SHIP_CLASS_IDS) {
      const c = SHIP_CLASSES[id];
      expect(c.masts.length, id).toBeGreaterThan(0);
      expect(c.guns.length, id).toBeGreaterThan(0);
      expect(c.crew, id).toBeGreaterThan(0);
    }
  });
});

describe("event queue", () => {
  it("drains in push order", () => {
    const q = new EventQueue();
    q.push({ type: "splash", at: ZERO, size: 1 });
    q.push({ type: "ricochet", at: ZERO });
    expect(q.size).toBe(2);
    expect(q.drain().map((e) => e.type)).toEqual(["splash", "ricochet"]);
    expect(q.size).toBe(0);
  });
});

describe("vector and scalar helpers", () => {
  it("compute the usual identities", () => {
    const a = vec3(1, 2, 3);
    const b = vec3(-2, 0, 1);
    expect(add(a, b)).toEqual(vec3(-1, 2, 4));
    expect(sub(a, b)).toEqual(vec3(3, 2, 2));
    expect(scale(a, 2)).toEqual(vec3(2, 4, 6));
    expect(addScaled(a, b, 2)).toEqual(vec3(-3, 2, 5));
    expect(dot(a, b)).toBe(1);
    expect(cross(vec3(1, 0, 0), vec3(0, 1, 0))).toEqual(vec3(0, 0, 1));
    expect(lengthSq(a)).toBe(14);
    expect(length(vec3(3, 4, 0))).toBe(5);
    expect(distance(a, a)).toBe(0);
    expect(length(normalize(a))).toBeCloseTo(1);
    expect(normalize(ZERO)).toEqual(ZERO);
    expect(mulv(a, b)).toEqual(vec3(-2, 0, 3));
    expect(isFiniteVec(vec3(0, Number.NaN, 0))).toBe(false);
    expect(lengthXZ(vec3(3, 9, 4))).toBe(5);
    expect(clamp01(2)).toBe(1);
    expect(lerp(0, 10, 0.25)).toBe(2.5);
    expect(smoothstep(0, 1, 0.5)).toBe(0.5);
  });

  it("noise and ranges stay bounded", () => {
    const v = noise1(seedOf("x"), 3.3);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
    const r = createRng(9);
    const x = range(r, 5, 6);
    expect(x).toBeGreaterThanOrEqual(5);
    expect(r.state()).toBeTypeOf("number");
  });

  it("measures the vertical speed of the surface", () => {
    const w = [makeWave(0, 30, 1, 0.5, 0, 1)];
    const omega = w[0]!.omega;
    // At the rest point with phase 0 the surface rises at a * omega.
    expect(Math.abs(waterVerticalSpeed(w, 0, 0, 0))).toBeGreaterThan(omega * 0.5);
  });
});
