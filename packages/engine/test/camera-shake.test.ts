import { describe, expect, it } from "vitest";
import { CameraShake } from "../src/camera/camera-shake";

describe("camera shake from trauma", () => {
  it("is still without trauma and when switched off", () => {
    const a = new CameraShake();
    expect(a.step(1 / 60)).toEqual({ x: 0, y: 0 });
    const b = new CameraShake();
    b.enabled = false;
    b.add(1);
    expect(b.step(1 / 60)).toEqual({ x: 0, y: 0 });
  });

  it("stays within trauma squared and dies out", () => {
    const s = new CameraShake();
    s.add(0.6);
    let peak = 0;
    for (let i = 0; i < 120; i++) {
      const o = s.step(1 / 60);
      peak = Math.max(peak, Math.abs(o.x), Math.abs(o.y));
      expect(Math.abs(o.x)).toBeLessThanOrEqual(0.36 + 1e-9);
    }
    expect(peak).toBeGreaterThan(0.05);
    expect(s.level).toBe(0);
  });

  it("caps trauma at 1", () => {
    const s = new CameraShake();
    s.add(0.8);
    s.add(0.8);
    expect(s.level).toBe(1);
  });
});
