import { describe, expect, it } from "vitest";
import { FramePacer } from "../src/frame-pacing";

const drawn = (cap: number, hz: number, seconds: number, jitter = 0): number => {
  const p = new FramePacer(cap);
  let n = 0;
  for (let i = 0; i < hz * seconds; i++) if (p.due((i * 1000) / hz + (i % 2 ? jitter : -jitter))) n++;
  return n;
};

describe("frame pacer", () => {
  it("draws every refresh without a cap", () => {
    expect(drawn(0, 60, 2)).toBe(120);
  });

  it("holds 30 fps on 60 Hz and 120 Hz screens, with jittery refreshes too", () => {
    expect(drawn(30, 60, 2)).toBeGreaterThanOrEqual(59);
    expect(drawn(30, 60, 2)).toBeLessThanOrEqual(61);
    expect(drawn(30, 120, 2)).toBeGreaterThanOrEqual(59);
    expect(drawn(30, 120, 2)).toBeLessThanOrEqual(61);
    expect(drawn(30, 60, 2, 1.5)).toBeGreaterThanOrEqual(59);
    expect(drawn(30, 60, 2, 1.5)).toBeLessThanOrEqual(61);
  });

  it("does not rush frames after a stall", () => {
    const p = new FramePacer(30);
    expect(p.due(0)).toBe(true);
    expect(p.due(1000)).toBe(true);
    expect(p.due(1016.7)).toBe(false);
    expect(p.due(1033.4)).toBe(true);
  });
});
