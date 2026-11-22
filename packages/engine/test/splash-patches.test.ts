import { describe, expect, it } from "vitest";
import { SplashPatches } from "../src/renderer/splash-patches";
import { SPLASHES } from "../src/shaders/splash-foam";

describe("foam where shot fell", () => {
  it("keeps the newest splashes, ages them and lets them go after ten seconds", () => {
    const p = new SplashPatches();
    for (let i = 0; i < SPLASHES + 3; i++) p.add(i, 0, 1, i * 0.1);
    let u = p.uniforms(2);
    expect(u.count).toBe(SPLASHES);
    // The oldest three gave way: the first kept is the fourth.
    expect(u.data[0]).toBe(3);
    expect(u.data[2]).toBeCloseTo(2 - 0.3);
    expect(u.data[3]).toBeCloseTo(4.5);
    u = p.uniforms(20);
    expect(u.count).toBe(0);
  });
});
