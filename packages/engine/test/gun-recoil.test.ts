import { describe, expect, it } from "vitest";
import { RECOIL_TIME, recoilShare } from "../src/renderer/gun-recoil";

describe("gun recoil", () => {
  it("leaps inboard, holds while loading, and runs out again", () => {
    expect(recoilShare(0)).toBe(0);
    expect(recoilShare(0.06)).toBeGreaterThan(0.5);
    expect(recoilShare(0.2)).toBe(1);
    expect(recoilShare(2)).toBe(1);
    const late = recoilShare(RECOIL_TIME - 0.4);
    expect(late).toBeGreaterThan(0);
    expect(late).toBeLessThan(0.3);
    expect(recoilShare(RECOIL_TIME)).toBe(0);
  });

  it("never moves backwards while running out", () => {
    let prev = 1;
    for (let t = 2.4; t < RECOIL_TIME; t += 0.05) {
      const s = recoilShare(t);
      expect(s).toBeLessThanOrEqual(prev);
      prev = s;
    }
  });
});
