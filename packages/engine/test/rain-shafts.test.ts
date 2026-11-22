import { describe, expect, it } from "vitest";
import { curtainEnvelope } from "../src/renderer/rain-shafts";

describe("rain curtain envelope (no hard silhouette on the horizon)", () => {
  it("is clear at its sides and top, full in the middle and low down", () => {
    expect(curtainEnvelope(0, 0.8)).toBeLessThan(0.05);
    expect(curtainEnvelope(1, 0.8)).toBeLessThan(0.05);
    expect(curtainEnvelope(0.5, 0)).toBe(0);
    expect(curtainEnvelope(0.5, 0.8)).toBeCloseTo(1);
    expect(curtainEnvelope(0.5, 0.2)).toBeGreaterThan(0.3);
    expect(curtainEnvelope(0.5, 0.2)).toBeLessThan(0.7);
  });
});
