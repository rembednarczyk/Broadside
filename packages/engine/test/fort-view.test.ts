import { describe, expect, it } from "vitest";
import { FORT_CLASSES, fortLayout } from "@broadside/core";
import { BREACHED, SCARRED, partShares, partStates, stoneShade } from "../src/renderer/fort-damage";
import { spansWithout } from "../src/renderer/fort-build";
import { faceAt } from "../src/renderer/fort-marks";
import { flagRipple } from "../src/renderer/fort-flag";
import { figuresFor, garrisonPosts } from "../src/renderer/fort-props";

describe("a fort's damage as the eye sees it (beta test 22.11)", () => {
  it("shares the walls' hit points out by the parts' size, and breaches the battered part", () => {
    const def = FORT_CLASSES.starFort;
    const shares = partShares(def);
    expect(shares.reduce((a, b) => a + b, 0)).toBeCloseTo(def.hp);
    const scars = shares.map(() => 0);
    scars[2] = shares[2]! * (SCARRED + 0.01);
    scars[3] = shares[3]! * (BREACHED + 0.01);
    const s = partStates(def, scars);
    expect(s[0]).toBe(0);
    expect(s[2]).toBe(1);
    expect(s[3]).toBe(2);
    expect(stoneShade(1)).toBe(1);
    expect(stoneShade(0)).toBeCloseTo(0.6);
  });

  it("cuts embrasures and breaches out of a parapet", () => {
    expect(spansWithout([])).toEqual([[0, 1]]);
    expect(spansWithout([[0.4, 0.6], [0.1, 0.2]])).toEqual([[0, 0.1], [0.2, 0.4], [0.6, 1]]);
    expect(spansWithout([[-0.1, 0.05], [0.9, 1.2]])).toEqual([[0.05, 0.9]]);
  });

  it("lays a scar on the face of the wall the ball struck", () => {
    const def = FORT_CLASSES.battery;
    const w = fortLayout(def).walls[2]!;
    const mx = (w.x0 + w.x1) / 2;
    const mz = (w.z0 + w.z1) / 2;
    // Just outside the middle of the rampart, seaward.
    const f = faceAt(def, mx * 1.02, 3, mz + 1.5)!;
    expect(f).not.toBeNull();
    expect(f.n.z).toBeGreaterThan(0.8);
    expect(Math.hypot(f.p.x - mx, f.p.z - mz)).toBeLessThan(3);
    // Far from any work: no face.
    expect(faceAt(def, 0, 3, 200)).toBeNull();
  });

  it("ripples the fly of a flag, not its hoist, more in a stronger wind", () => {
    expect(flagRipple(0, 3, 10, 0)).toBe(0);
    const amp = (wind: number) => Math.max(...Array.from({ length: 50 }, (_, i) => Math.abs(flagRipple(1, i * 0.1, wind, 0))));
    expect(amp(14)).toBeGreaterThan(amp(2));
  });
});

describe("a fort's garrison on its walls", () => {
  it("shows a figure per eight men, at most forty, standing on the walls behind the parapets", () => {
    expect(figuresFor(0)).toBe(0);
    expect(figuresFor(80)).toBe(10);
    expect(figuresFor(4000)).toBe(40);
    const def = FORT_CLASSES.starFort;
    const posts = garrisonPosts(def, 12);
    expect(posts).toHaveLength(12);
    for (const p of posts) {
      expect(p.y).toBe(def.height);
      expect(Math.hypot(p.x, p.z)).toBeLessThan(def.radius + 1);
    }
    expect(garrisonPosts(FORT_CLASSES.watchtower, 4).every((p) => p.y === FORT_CLASSES.watchtower.height)).toBe(true);
  });
});
