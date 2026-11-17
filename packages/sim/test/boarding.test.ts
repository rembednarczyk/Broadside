import { describe, expect, it } from "vitest";
import { type DomainEvent } from "@broadside/core";
import { Simulation } from "../src/simulation";

const run = (sim: Simulation, seconds: number, sink: DomainEvent[] = []) => {
  for (let i = 0; i < seconds * 60; i++) {
    sim.step();
    sink.push(...sim.drainEvents());
  }
  return sink;
};

describe("boarding", () => {
  it("takes a weakened ship alongside and her plunder", () => {
    const sim = new Simulation({ seed: 8, windDirection: 0, windSpeed: 0 });
    const me = sim.spawnShip({ classId: "brig", faction: "player", x: 0, z: 0, heading: 0, player: true });
    const prey = sim.spawnShip({ classId: "sloop", faction: "pirates", x: 16, z: 0, heading: 0 });
    prey.ship!.crew = 15;
    sim.command({ type: "board", ship: me.id, target: prey.id });
    const ev = run(sim, 0.2);
    expect(ev.some((e) => e.type === "boarded" && e.won)).toBe(true);
    expect(prey.ship!.struck).toBe(true);
    expect(sim.purse.plunder).toBeGreaterThan(0);
  });

  it("is beaten back by a bigger crew", () => {
    const sim = new Simulation({ seed: 8, windDirection: 0, windSpeed: 0 });
    const me = sim.spawnShip({ classId: "cutter", faction: "player", x: 0, z: 0, heading: 0, player: true });
    const big = sim.spawnShip({ classId: "frigate", faction: "pirates", x: 16, z: 0, heading: 0 });
    const before = me.ship!.crew;
    sim.command({ type: "board", ship: me.id, target: big.id });
    const ev = run(sim, 0.2);
    expect(ev.some((e) => e.type === "boarded" && !e.won)).toBe(true);
    expect(me.ship!.crew).toBeLessThan(before);
  });

  it("needs to be alongside", () => {
    const sim = new Simulation({ seed: 8, windDirection: 0, windSpeed: 0 });
    const me = sim.spawnShip({ classId: "brig", faction: "player", x: 0, z: 0, heading: 0, player: true });
    const far = sim.spawnShip({ classId: "sloop", faction: "pirates", x: 200, z: 0, heading: 0 });
    sim.command({ type: "board", ship: me.id, target: far.id });
    expect(run(sim, 0.2).some((e) => e.type === "boarded")).toBe(false);
  });
});
