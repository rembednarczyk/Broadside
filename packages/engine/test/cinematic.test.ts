import { describe, expect, it } from "vitest";
import { type CineState, DIP_PERIOD, clearance, orbitRadius, rideStep, tiltStep } from "../src/camera/cinematic";

describe("cinematic camera riding the swell", () => {
  it("keeps the lens about a metre over the water and sinks it through the surface once a period", () => {
    let under = 0;
    for (let t = 0; t < DIP_PERIOD; t += 0.1) {
      const c = clearance(t);
      expect(c).toBeLessThan(1.8);
      if (c < 0) under += 0.1;
      else if (t < DIP_PERIOD * 0.3) expect(c).toBeGreaterThan(0.8);
    }
    // Under for a moment, not for long.
    expect(under).toBeGreaterThan(0.5);
    expect(under).toBeLessThan(6);
  });

  it("circles the ship at a fixed distance and rides the sea, lagging on short waves", () => {
    const ship = { x: 10, z: -5, length: 40 };
    const flat: CineState = { angle: 0, t: 0, y: 5 };
    let eye = { x: 0, y: 0, z: 0 };
    for (let i = 0; i < 300; i++) eye = rideStep(flat, ship, () => 0, 1 / 60);
    expect(Math.hypot(eye.x - ship.x, eye.z - ship.z)).toBeCloseTo(orbitRadius(40), 6);
    expect(Math.abs(eye.y - clearance(flat.t))).toBeLessThan(0.15);
    // On a short steep swell the float cannot keep up: the lens sits nearer the crests than its clearance.
    const chop: CineState = { angle: 0, t: 0, y: 1.3 };
    let worst = Infinity;
    for (let i = 0; i < 600; i++) {
      const e = rideStep(chop, ship, (x, z) => 1.2 * Math.sin(chop.t * 4 + x * 0 + z * 0), 1 / 60);
      worst = Math.min(worst, e.y - 1.2 * Math.sin(chop.t * 4));
    }
    expect(worst).toBeLessThan(clearance(0) - 0.4);
  });
});

describe("cinematic camera under the water", () => {
  it("turns up to the surface while under it and back to the ship once out, without a cut", () => {
    const s: CineState = { angle: 0, t: 0, y: 0 };
    expect(tiltStep(s, -1, 1 / 60)).toBe(0);
    let last = 0;
    for (let i = 0; i < 180; i++) {
      const k = tiltStep(s, 0.8, 1 / 60);
      expect(k - last).toBeLessThan(0.05);
      last = k;
    }
    expect(last).toBeGreaterThan(0.9);
    for (let i = 0; i < 180; i++) last = tiltStep(s, -0.5, 1 / 60);
    expect(last).toBeLessThan(0.1);
  });
});
