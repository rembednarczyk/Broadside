import { describe, expect, it } from "vitest";
import { STRIKE_LENGTH, flashCurve, lightningBolt } from "../src/renderer/lightning-bolt";

describe("lightning", () => {
  it("runs a jagged channel from the cloud base to the water, with branches leaving it downwards", () => {
    const b = lightningBolt(120, -340);
    expect(b.channel[0]![1]).toBeCloseTo(420, 6);
    const last = b.channel[b.channel.length - 1]!;
    expect([last[0], last[1], last[2]]).toEqual([120, 0, -340]);
    expect(b.channel.length).toBe(129);
    expect(b.branches.length).toBeGreaterThanOrEqual(2);
    expect(b.branches.length).toBeLessThanOrEqual(5);
    for (const br of b.branches) {
      expect(br[br.length - 1]![1]).toBeLessThan(br[0]![1]);
      expect(b.channel).toContainEqual(br[0]);
    }
    // The same strike looks the same every time; another strike looks different.
    expect(lightningBolt(120, -340)).toEqual(b);
    expect(lightningBolt(121, -340)).not.toEqual(b);
  });

  it("flickers with several return strokes and dies out", () => {
    expect(flashCurve(0)).toBeCloseTo(1, 6);
    // Darker between the first and the second stroke than at the second.
    expect(flashCurve(0.09)).toBeLessThan(flashCurve(0.11));
    expect(flashCurve(0.26)).toBeGreaterThan(flashCurve(0.2));
    expect(flashCurve(STRIKE_LENGTH)).toBeLessThan(0.05);
    expect(flashCurve(-0.1)).toBe(0);
  });
});
