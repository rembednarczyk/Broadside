/// <reference types="node" />
import { expect, it } from "vitest";
import { type WeatherKind } from "@broadside/core";
import { DIRECTOR, STEP } from "@broadside/sim";
import { GameSession } from "../src/game-session";

/**
 * Soak run of the sandbox (M5 budgets): an hour of play with the population director, storm
 * cells, AI fights and contracts, the player's ship sailing a slow circle and firing whenever an
 * enemy is laid. Reports per ten minutes: ships, other entities, cells, ms per step, the player's
 * state; fails on NaN or a runaway entity count. `WEATHER=storm pnpm run audit` to change the sky.
 */
it("the sandbox stays bounded and finite (report, gated by ADR-0005)", () => {
  const s = new GameSession({ seed: 11, weather: (process.env.WEATHER as WeatherKind | undefined) ?? "squally" });
  const minutes = Number(process.env.MINUTES ?? 20);
  let worstMs = 0;
  for (let m = 1; m <= minutes; m++) {
    const t0 = process.hrtime.bigint();
    for (let i = 0; i < 60 * 60; i++) {
      if (i % 120 === 0) {
        s.steer(m % 4 === 0 ? 1 : 0);
        s.fire("broadside", "port");
        s.fire("broadside", "starboard");
      }
      s.advance(STEP);
    }
    const ms = Number(process.hrtime.bigint() - t0) / 1e6 / 3600;
    worstMs = Math.max(worstMs, ms);
    const ships = s.sim.ships();
    for (const e of ships) {
      const p = e.body!.pos;
      if (!Number.isFinite(p.x + p.y + p.z)) throw new Error(`NaN position on ship ${e.id} at minute ${m}`);
    }
    let all = 0;
    for (const _ of s.sim.world) all++;
    expect(all, `entities at minute ${m} (ADR-0005)`).toBeLessThanOrEqual(120);
    expect(ships.length, `ships at minute ${m} (ADR-0005)`).toBeLessThanOrEqual(DIRECTOR.budget + 3);
    if (m % 10 === 0 || m === minutes) {
      const me = s.sim.byId(s.playerId);
      console.log(`min ${String(m).padStart(3)}: ships ${ships.length}, entities ${all}, cells ${s.sim.env.cells.length}, ${ms.toFixed(2)} ms/step, gold ${s.sim.purse.gold}, player ${me ? `${me.ship!.crew} crew, hull ${(me.ship!.sections.reduce((a, x) => a + x.hp, 0) / (me.ship!.model.def.sectionHp * 6) * 100).toFixed(0)}%${me.ship!.sinking ? " SINKING" : ""}` : "gone"}, standing ${JSON.stringify(s.sim.relations)}`);
    }
  }
  console.log(`worst ms/step ${worstMs.toFixed(2)} (ADR-0005: at most 2 ms here)`);
  expect(worstMs).toBeLessThanOrEqual(2);
});
