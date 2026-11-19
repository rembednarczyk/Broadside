import { describe, expect, it } from "vitest";
import { wreckSites } from "@broadside/core";
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
    // The nearest wreck; the ship set down 350 m off it across the wind (a reach: to windward the
    // pilot is weak, decyzje 18.11).
    const best = sites.map((w, i) => ({ w, i, d: Math.hypot(w.x - me.body!.pos.x, w.z - me.body!.pos.z) })).sort((a, b) => a.d - b.d)[0]!;
    const wd = s.sim.env.windDirection;
    me.body!.pos = { ...me.body!.pos, x: best.w.x + Math.cos(wd) * 350, z: best.w.z - Math.sin(wd) * 350 };
    me.body!.vel = { x: 0, y: 0, z: 0 };
    const gold = s.sim.purse.gold;
    s.helm.order({ kind: "salvage", at: { x: best.w.x, z: best.w.z } });
    for (let i = 0; i < 60 * 300 && !s.sim.salvage.salvaged.includes(best.i); i++) s.advance(STEP);
    expect(s.sim.salvage.salvaged).toContain(best.i);
    expect(s.sim.purse.gold).toBeGreaterThan(gold);
  });
});
