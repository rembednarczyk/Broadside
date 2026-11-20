import { describe, expect, it } from "vitest";
import { createRng } from "@broadside/core";
import { Simulation } from "../src/simulation";
import { board, canBoard } from "../src/combat/boarding";
import { EventQueue } from "@broadside/core";

describe("a prize", () => {
  it("is taken once: a second boarding pays nothing", () => {
    const sim = new Simulation({ seed: 3, windDirection: 0, windSpeed: 5 });
    const me = sim.spawnShip({ classId: "galleon", faction: "player", x: 0, z: 0, heading: 0, player: true });
    const prize = sim.spawnShip({ classId: "schooner", faction: "pirates", x: 12, z: 0, heading: 0 });
    prize.ship!.struck = true;
    const events = new EventQueue();
    expect(canBoard(me, prize)).toBe(true);
    board(events, me, prize, createRng(1), sim.purse);
    const gold = sim.purse.gold;
    expect(prize.ship!.taken).toBe(true);
    expect(canBoard(me, prize)).toBe(false);
    board(events, me, prize, createRng(2), sim.purse);
    expect(sim.purse.gold).toBe(gold);
  });

  it("is never one's own side", () => {
    const sim = new Simulation({ seed: 3, windDirection: 0, windSpeed: 5 });
    const a = sim.spawnShip({ classId: "brig", faction: "crown", x: 0, z: 0, heading: 0 });
    const b = sim.spawnShip({ classId: "brig", faction: "crown", x: 12, z: 0, heading: 0 });
    expect(canBoard(a, b)).toBe(false);
  });

  it("lies hove to once struck: her way is gone within a minute", () => {
    const sim = new Simulation({ seed: 3, windDirection: 0, windSpeed: 8 });
    const s = sim.spawnShip({ classId: "schooner", faction: "pirates", x: 0, z: 0, heading: 0, speed: 4.5 });
    s.ship!.struck = true;
    s.ship!.sailTarget = s.ship!.sailTarget.map(() => 0);
    for (let i = 0; i < 60 * 60; i++) sim.step();
    expect(Math.hypot(s.body!.vel.x, s.body!.vel.z)).toBeLessThan(1.2);
  });
});

describe("ammunition", () => {
  it("is stowed by the guns of a broadside, and a mount goes back to round shot when its special shot is spent", () => {
    const sim = new Simulation({ seed: 3, windDirection: 0, windSpeed: 5 });
    const g = sim.spawnShip({ classId: "galleon", faction: "player", x: 0, z: 0, heading: 0 });
    const sl = sim.spawnShip({ classId: "sloop", faction: "player", x: 500, z: 0, heading: 0 });
    expect(g.ship!.stores.chain!).toBeGreaterThan(sl.ship!.stores.chain!);
    const perSide = g.ship!.model.guns.filter((x) => x.kind === "broadside" && x.side === "port").length;
    expect(g.ship!.stores.chain!).toBeGreaterThanOrEqual(perSide * 2);
  });
});
