import { describe, expect, it } from "vitest";
import { SHIP_CLASSES, SHIP_CLASS_IDS } from "@broadside/core";
import { rigPlan } from "../src/renderer/rig-plan";
import { paintSail, type SailPaint } from "../src/renderer/sail-texture";

describe("rig plan", () => {
  it("splits square canvas into three tiers (emblems on course and topsail) and keeps every sail mapped", () => {
    for (const id of SHIP_CLASS_IDS) {
      const def = SHIP_CLASSES[id];
      const plan = rigPlan(def);
      const squares = def.masts.flatMap((m) => m.sails).filter((s) => s.rig === "square").length;
      expect(plan.sails.filter((s) => s.shape === "square" && s.emblem).length, id).toBe(squares * 2);
      for (const s of plan.sails) {
        expect(def.masts[s.mast]!.sails[s.sail], id).toBeDefined();
        expect(s.width, id).toBeGreaterThan(0);
        expect(s.height, id).toBeGreaterThan(0);
      }
      expect(plan.mastTops).toHaveLength(def.masts.length);
    }
  });

  it("stacks tiers upwards on the galleon's mainmast", () => {
    const plan = rigPlan(SHIP_CLASSES.galleon);
    const main = plan.sails.filter((s) => s.mast === 1 && s.shape === "square").map((s) => s.foot);
    expect(main).toEqual([...main].sort((a, b) => a - b));
    expect(new Set(main).size).toBe(3);
  });
});

describe("sail texture", () => {
  it("paints deterministically for every faction", () => {
    for (const f of ["player", "crown", "republic", "empire", "pirates"] as const) {
      const ops: string[] = [];
      const ctx = new Proxy({} as SailPaint, {
        get: (_t, k) => (typeof k === "string" && !["fillStyle", "strokeStyle", "lineWidth", "globalAlpha"].includes(k) ? (...a: number[]) => ops.push(`${k}:${a.map((x) => x.toFixed(1)).join(",")}`) : undefined),
        set: () => true,
      });
      paintSail(ctx, 256, f, true);
      const again: string[] = [];
      const ctx2 = new Proxy({} as SailPaint, { get: (_t, k) => (typeof k === "string" && !["fillStyle", "strokeStyle", "lineWidth", "globalAlpha"].includes(k) ? (...a: number[]) => again.push(`${k}:${a.map((x) => x.toFixed(1)).join(",")}`) : undefined), set: () => true });
      paintSail(ctx2, 256, f, true);
      expect(again).toEqual(ops);
      expect(ops.length).toBeGreaterThan(20);
    }
  });

  it("frays only the foot: the cut-away shapes lie in the lowest part of the cloth", () => {
    const cuts: number[][] = [];
    let cutting = false;
    const ctx = new Proxy({} as SailPaint, {
      get: (_t, k) => (k === "moveTo" || k === "lineTo" ? (x: number, y: number) => cutting && cuts.push([x, y]) : typeof k === "string" && !["fillStyle", "strokeStyle", "lineWidth", "globalAlpha", "globalCompositeOperation"].includes(k) ? () => undefined : undefined),
      set: (_t, k, v) => {
        if (k === "globalCompositeOperation") cutting = v === "destination-out";
        return true;
      },
    });
    paintSail(ctx, 512, "player", true);
    expect(cuts.length).toBeGreaterThan(90);
    for (const [, y] of cuts) expect(y!).toBeGreaterThan(512 * 0.85);
    // Some tears run well up from the edge.
    expect(Math.min(...cuts.map((c) => c[1]!))).toBeLessThan(512 * 0.95);
  });
});
