import { describe, expect, it } from "vitest";
import { twistDelta } from "../src/camera/twist";

describe("two-finger twist", () => {
  it("measures the turn of the line between the fingers, wrapped", () => {
    expect(twistDelta({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 10 })).toBeCloseTo(Math.PI / 2);
    expect(twistDelta({ x: 0, y: 0 }, { x: -10, y: 1 }, { x: 0, y: 0 }, { x: -10, y: -1 })).toBeCloseTo(0.2, 1);
    // A pinch (the fingers apart along the same line) turns nothing.
    expect(twistDelta({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: -5, y: 0 }, { x: 20, y: 0 })).toBeCloseTo(0);
  });
});
