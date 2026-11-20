import { describe, expect, it } from "vitest";
import { terrainHeight, wreckSites } from "@broadside/core";
import { STEP } from "@broadside/sim";
import { GameSession } from "../src/game-session";
import { orderFor } from "../src/controllers/tap-targets";

describe("a tap on a wreck", () => {
  it("is an order to salvage her", () => {
    expect(orderFor({ kind: "wreck", id: 2, sx: 0, sy: 0, reach: 30, at: { x: 5, z: 6 } }, null)).toEqual({ kind: "salvage", at: { x: 5, z: 6 } });
  });

  it("sends the crew to lie over the wreck, and her cargo comes aboard", () => {
    const s = new GameSession({ seed: 7 });
    const me = s.sim.byId(s.playerId)!;
    const sites = wreckSites(s.sim.env.archipelago!);
    // The nearest wreck with a clear approach: from a point 350 m off her to windward, the course to
    // her a broad reach (the ship gathering way from rest sags to leeward, and the pilot is weak
    // beating to windward, decyzje 18.11), deep water all the way to 100 m short
    // of her. The ship is set down there (finding a way round the land is the route planner's
    // test, sim/test/plan).
    const a = s.sim.env.archipelago!;
    const wd = s.sim.env.windDirection;
    const clearRun = (w: { x: number; z: number }, from: { x: number; z: number }) => {
      const d = Math.hypot(w.x - from.x, w.z - from.z);
      for (let r = 0; r < d - 100; r += 10) if (terrainHeight(a, from.x + ((w.x - from.x) / d) * r, from.z + ((w.z - from.z) / d) * r) > -8) return false;
      return true;
    };
    const candidates = sites.flatMap((w, i) => [0.9, -0.9].map((k) => ({ w, i, from: { x: w.x - Math.sin(wd + k) * 350, z: w.z - Math.cos(wd + k) * 350 } })));
    const best = candidates.filter((c) => clearRun(c.w, c.from)).sort((p, q) => Math.hypot(p.w.x, p.w.z) - Math.hypot(q.w.x, q.w.z))[0]!;
    const start = best.from;
    me.body!.pos = { ...me.body!.pos, x: start.x, z: start.z };
    me.body!.vel = { x: 0, y: 0, z: 0 };
    const gold = s.sim.purse.gold;
    s.helm.order({ kind: "salvage", at: { x: best.w.x, z: best.w.z } });
    for (let i = 0; i < 60 * 300 && !s.sim.salvage.salvaged.includes(best.i); i++) s.advance(STEP);
    expect(s.sim.salvage.salvaged).toContain(best.i);
    expect(s.sim.purse.gold).toBeGreaterThan(gold);
  });
});
