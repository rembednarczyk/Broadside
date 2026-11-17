import { describe, expect, it } from "vitest";
import { createRng, gauss, hashString, intRange, pick, subRng } from "../src/math/rng";
import { integrateQuat, quatFromYaw, rotate, rotateInv, yawOf, rollOf, pitchOf, quatFromAxisAngle } from "../src/math/quat";
import { vec3 } from "../src/math/vec3";
import { approach, quantize, wrapAngle } from "../src/math/scalar";
import { fbm2, noise2 } from "../src/math/noise";

describe("rng", () => {
  it("repeats for a seed and differs per stream", () => {
    const a = createRng(5);
    const b = createRng(5);
    expect([a.next(), a.next()]).toEqual([b.next(), b.next()]);
    expect(subRng(5, "a").next()).not.toBe(subRng(5, "b").next());
    expect(hashString("x")).toBe(hashString("x"));
  });
  it("stays in range", () => {
    const r = createRng(1);
    for (let i = 0; i < 1000; i++) {
      const v = intRange(r, 2, 4);
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThanOrEqual(4);
    }
    expect(Math.abs(gauss(r))).toBeLessThan(4);
    expect(() => pick(r, [])).toThrow();
  });
});

describe("quaternions", () => {
  it("rotates and inverts", () => {
    const q = quatFromYaw(Math.PI / 2);
    const v = rotate(q, vec3(0, 0, 1));
    expect(v.x).toBeCloseTo(1);
    const back = rotateInv(q, v);
    expect(back.z).toBeCloseTo(1);
    expect(yawOf(q)).toBeCloseTo(Math.PI / 2);
  });
  it("integrates a yaw rate", () => {
    let q = quatFromYaw(0);
    for (let i = 0; i < 100; i++) q = integrateQuat(q, vec3(0, 1, 0), 0.01);
    expect(yawOf(q)).toBeCloseTo(1, 2);
  });
  it("reads heel and trim", () => {
    // Starboard down: rotate around the bow axis (+Z) by a negative angle lowers +X.
    expect(rollOf(quatFromAxisAngle(vec3(0, 0, 1), -0.2))).toBeCloseTo(0.2);
    expect(pitchOf(quatFromAxisAngle(vec3(1, 0, 0), -0.1))).toBeCloseTo(0.1);
  });
});

describe("scalars and noise", () => {
  it("wraps, approaches and quantizes", () => {
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(Math.PI);
    expect(wrapAngle(-3 * Math.PI)).toBeCloseTo(Math.PI);
    expect(approach(0, 1, 0.3)).toBeCloseTo(0.3);
    expect(approach(1, 0, 0.3)).toBeCloseTo(0.7);
    expect(quantize(1.23456, 2)).toBe(1.23);
  });
  it("is smooth and bounded", () => {
    expect(noise2(1, 0.5, 0.5)).toBeGreaterThanOrEqual(0);
    expect(Math.abs(noise2(1, 0.5, 0.5) - noise2(1, 0.51, 0.5))).toBeLessThan(0.05);
    const v = fbm2(3, 2.2, 7.1, 4);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  });
});
