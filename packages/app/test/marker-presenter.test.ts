import { describe, expect, it } from "vitest";
import { presentMarker } from "../src/presenters/marker-presenter";

describe("enemy marker", () => {
  it("hides when the enemy is in the clear middle of the screen", () => {
    expect(presentMarker({ x: 0.5, y: 0.5 }, 200)).toBeNull();
  });

  it("sits on the edge of the clear area towards the enemy and points at it", () => {
    const m = presentMarker({ x: 0.1, y: 0.1 }, 300)!;
    expect(m.x).toBeGreaterThanOrEqual(0.24 - 1e-9);
    expect(m.y).toBeGreaterThanOrEqual(0.2 - 1e-9);
    expect(m.x === 0.24 || Math.abs(m.y - 0.2) < 1e-9 || Math.abs(m.x - 0.24) < 1e-9).toBe(true);
    expect(m.angle).toBeLessThan(0);
    const right = presentMarker({ x: 1.4, y: 0.5 }, 300)!;
    expect(right.x).toBeCloseTo(0.76);
    expect(right.angle).toBeCloseTo(Math.PI / 2);
  });
});
