import { describe, expect, it } from "vitest";
import { SHIP_CLASSES, SHIP_CLASS_IDS } from "@broadside/core";
import { deckGeometry, hullGeometry } from "../src/renderer/hull-geometry";
import { liveryOps, paint, type PaintTarget } from "../src/renderer/hull-livery";
import { SAIL_COLS, SAIL_ROWS, sailIndices, sailPositions } from "../src/renderer/sail-geometry";
import { sceneLook } from "../src/renderer/look";
import { buildOceanGrid } from "../src/renderer/ocean";

describe("hull geometry", () => {
  it("lofts a closed, valid mesh for every class", () => {
    for (const id of SHIP_CLASS_IDS) {
      for (const g of [hullGeometry(SHIP_CLASSES[id].hull), deckGeometry(SHIP_CLASSES[id].hull)]) {
        const n = g.positions.length / 3;
        expect(g.uvs.length / 2, id).toBe(n);
        expect(g.indices.length % 3).toBe(0);
        expect(Math.max(...g.indices)).toBeLessThan(n);
        expect(g.positions.every(Number.isFinite)).toBe(true);
      }
    }
  });

  it("stays within the beam and the length", () => {
    const h = SHIP_CLASSES.frigate.hull;
    const g = hullGeometry(h);
    for (let i = 0; i < g.positions.length; i += 3) {
      expect(Math.abs(g.positions[i]!)).toBeLessThanOrEqual(h.beam / 2 + 1e-6);
      expect(Math.abs(g.positions[i + 2]!)).toBeLessThanOrEqual(h.length / 2 + 1e-6);
    }
  });
});

describe("livery", () => {
  it("paints a gun port per broadside gun and is deterministic", () => {
    const input = { hull: SHIP_CLASSES.brig.hull, gunDeck: 2.5, gunZ: [-8, -4, 0, 4, 8], stripe: [0.8, 0.6, 0.2] as const, seed: "brig" };
    const ops = liveryOps(input);
    expect(ops.filter((o) => o.op === "rect" && o.color === "rgb(14,10,8)")).toHaveLength(5);
    expect(liveryOps(input)).toEqual(ops);
    const calls: number[][] = [];
    const ctx: PaintTarget = { fillStyle: "", fillRect: (x, y, w, h) => calls.push([x, y, w, h]) };
    paint(ctx, ops, 100, 50);
    expect(calls).toHaveLength(ops.length);
  });
});

describe("sails", () => {
  it("gathers a square sail towards the yard and bulges to the given side", () => {
    const out = new Float32Array((SAIL_COLS + 1) * (SAIL_ROWS + 1) * 3);
    const o = { shape: "square" as const, width: 10, height: 8, foot: 2 };
    sailPositions(o, 1, 1, out);
    const top = out[(SAIL_ROWS * (SAIL_COLS + 1)) * 3 + 1]!;
    const bottomFull = out[1]!;
    sailPositions(o, 0.5, -1, out);
    expect(out[(SAIL_ROWS * (SAIL_COLS + 1)) * 3 + 1]).toBeCloseTo(top);
    expect(out[1]!).toBeGreaterThan(bottomFull);
    const mid = ((SAIL_ROWS / 2) * (SAIL_COLS + 1) + SAIL_COLS / 2) * 3;
    expect(out[mid]!).toBeLessThan(0);
    expect(sailIndices()).toHaveLength(SAIL_COLS * SAIL_ROWS * 6);
  });
});

describe("scene look", () => {
  it("is bright at noon, dark at midnight, grey in a storm", () => {
    const noon = sceneLook(12, 0, 0);
    const night = sceneLook(0, 0, 0);
    const storm = sceneLook(12, 1, 0);
    expect(noon.sunDir.y).toBeGreaterThan(0.8);
    expect(night.sunIntensity).toBe(0);
    expect(storm.sunIntensity).toBeLessThan(noon.sunIntensity);
    expect(storm.fogDensity).toBeGreaterThan(noon.fogDensity);
  });
});

describe("ocean grid", () => {
  it("is dense near the centre", () => {
    const g = buildOceanGrid();
    const xs = [...new Set(g.positions.filter((_, i) => i % 3 === 0))].sort((a, b) => a - b);
    const mid = xs.findIndex((x) => x >= 0);
    expect(xs[mid + 1]! - xs[mid]!).toBeLessThan(2);
    expect(xs[xs.length - 1]! - xs[xs.length - 2]!).toBeGreaterThan(30);
  });
});
