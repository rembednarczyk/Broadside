import { describe, expect, it } from "vitest";
import { jobMarker, presentMarker } from "../src/presenters/marker-presenter";

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

describe("contract marker", () => {
  const clear = { left: 0.24, right: 0.76, top: 0.2, bottom: 0.78 };
  it("points at the contract's ship out of view, and says what a tap orders", () => {
    const m = jobMarker({ target: 9, kind: "escort" }, { x: 900, z: 0 }, { x: 0, z: 0 }, () => ({ x: 1.3, y: 0.5 }), clear)!;
    expect(m.kind).toBe("job");
    expect(m.order).toBe("follow");
    expect(m.target).toBe(9);
    expect(m.range).toBeCloseTo(900);
    expect(jobMarker({ target: 9, kind: "bounty" }, { x: 900, z: 0 }, { x: 0, z: 0 }, () => ({ x: 1.3, y: 0.5 }), clear)!.order).toBe("engage");
  });
  it("is not drawn when she is in view or there is no contract", () => {
    expect(jobMarker({ target: 9, kind: "escort" }, { x: 100, z: 0 }, { x: 0, z: 0 }, () => ({ x: 0.5, y: 0.5 }), clear)).toBeNull();
    expect(jobMarker(null, null, { x: 0, z: 0 }, () => ({ x: 1.3, y: 0.5 }), clear)).toBeNull();
  });
});
