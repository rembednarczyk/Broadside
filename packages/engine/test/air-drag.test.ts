import { describe, expect, it } from "vitest";
import { airDrag } from "../src/effects/burst-emitter";

const vec = (x: number, y: number, z: number) => ({ x, y, z, set(a: number, b: number, c: number) { this.x = a; this.y = b; this.z = c; } });

describe("air drag of particles", () => {
  it("relaxes linearly with time constant 1/drag", () => {
    const v = vec(10, 0, 0);
    for (let i = 0; i < 60; i++) airDrag(v, { x: 0, y: 0, z: 0 }, 0.5, 0, 1 / 60);
    expect(v.x).toBeCloseTo(10 * Math.exp(-0.5), 6);
  });

  it("drifts towards the wind and never past it", () => {
    const v = vec(0, 0, 0);
    let prev = 0;
    for (let i = 0; i < 600; i++) {
      airDrag(v, { x: 8, y: 0, z: 0 }, 0.35, 0.25, 1 / 30);
      expect(v.x).toBeGreaterThanOrEqual(prev);
      expect(v.x).toBeLessThanOrEqual(8);
      prev = v.x;
    }
    expect(v.x).toBeGreaterThan(7.9);
  });

  it("slows a fast jet much quicker than a slow puff (quadratic part)", () => {
    const fast = vec(40, 0, 0);
    const slow = vec(2, 0, 0);
    airDrag(fast, { x: 0, y: 0, z: 0 }, 0.35, 0.25, 0.1);
    airDrag(slow, { x: 0, y: 0, z: 0 }, 0.35, 0.25, 0.1);
    expect(fast.x / 40).toBeLessThan(0.5);
    expect(slow.x / 2).toBeGreaterThan(0.9);
  });

  it("does not depend on the frame rate for linear drag", () => {
    const a = vec(5, 3, 0);
    const b = vec(5, 3, 0);
    for (let i = 0; i < 30; i++) airDrag(a, { x: 1, y: 0, z: 0 }, 0.8, 0, 1 / 30);
    for (let i = 0; i < 120; i++) airDrag(b, { x: 1, y: 0, z: 0 }, 0.8, 0, 1 / 120);
    expect(a.x).toBeCloseTo(b.x, 9);
    expect(a.y).toBeCloseTo(b.y, 9);
  });
});
