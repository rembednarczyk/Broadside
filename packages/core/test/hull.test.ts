import { describe, expect, it } from "vitest";
import { buildHullModel, WATER_DENSITY } from "../src/hull/hull-volume";
import { halfBreadth, planWidth } from "../src/hull/hull-shape";
import { SHIP_CLASSES, SHIP_CLASS_IDS } from "../src/data/ship-classes";

describe("hull model", () => {
  it("has a plausible block coefficient for every class", () => {
    for (const id of SHIP_CLASS_IDS) {
      const h = SHIP_CLASSES[id].hull;
      const m = buildHullModel(h);
      const cb = m.designVolume / (h.length * h.beam * h.draft);
      expect(cb, id).toBeGreaterThan(0.3);
      expect(cb, id).toBeLessThan(0.75);
      expect(m.totalVolume).toBeGreaterThan(m.designVolume);
    }
  });

  it("displaces a frigate of a few hundred tonnes", () => {
    const m = buildHullModel(SHIP_CLASSES.frigate.hull);
    const tonnes = (m.designVolume * WATER_DENSITY) / 1000;
    expect(tonnes).toBeGreaterThan(700);
    expect(tonnes).toBeLessThan(2000);
  });

  it("closes at the stem and keeps a transom", () => {
    const h = SHIP_CLASSES.sloop.hull;
    expect(planWidth(h, 1)).toBeCloseTo(0, 6);
    expect(planWidth(h, 0)).toBeCloseTo(h.transom, 6);
    expect(halfBreadth(h, 0.5, -h.draft - 0.1)).toBe(0);
    expect(halfBreadth(h, 0.46, 0)).toBeCloseTo(h.beam / 2, 6);
  });
});
