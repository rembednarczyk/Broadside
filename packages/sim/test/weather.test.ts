import { describe, expect, it } from "vitest";
import { type DomainEvent } from "@broadside/core";
import { Simulation } from "../src/simulation";
import { startRogue } from "../src/environment/environment";

const run = (sim: Simulation, seconds: number, sink: DomainEvent[] = []) => {
  for (let i = 0; i < seconds * 60; i++) {
    sim.step();
    sink.push(...sim.drainEvents());
  }
  return sink;
};

describe("weather in the world", () => {
  it("changes the wind over time when dynamic", () => {
    const sim = new Simulation({ seed: 8, windDirection: 0, windSpeed: 0, weather: "fresh" });
    const winds = new Set<number>();
    for (let i = 0; i < 60; i++) {
      run(sim, 1);
      winds.add(Math.round(sim.env.windSpeed * 10));
    }
    expect(winds.size).toBeGreaterThan(5);
  });

  it("lifts, spins and batters a ship caught by a waterspout", () => {
    const sim = new Simulation({ seed: 8, windDirection: 0, windSpeed: 3 });
    const e = sim.spawnShip({ classId: "sloop", faction: "player", x: 0, z: 0, heading: 0 });
    sim.world.add({ id: 0, spout: { x: 0, z: 0, vx: 0, vz: 0, radius: 18, age: 0, life: 30 } });
    const ev = run(sim, 10);
    expect(e.ship!.rigging).toBeLessThan(1);
    expect(Math.abs(e.body!.angVel.y)).toBeGreaterThan(0.05);
    expect(ev.some((x) => x.type === "crewOverboard")).toBe(true);
    run(sim, 25);
    expect([...sim.world.with("spout")]).toHaveLength(0);
  });

  it("raises the swell with a rogue wave group and lets it fall", () => {
    const sim = new Simulation({ seed: 8, windDirection: 0, windSpeed: 6 });
    startRogue(sim.env);
    run(sim, 15);
    expect(sim.env.swell).toBeGreaterThan(3);
    run(sim, 20);
    expect(sim.env.swell).toBe(0);
  });

  it("strains masts with too much sail in a gale", () => {
    const sim = new Simulation({ seed: 8, windDirection: Math.PI / 2, windSpeed: 22 });
    const e = sim.spawnShip({ classId: "brig", faction: "player", x: 0, z: 0, heading: 0 });
    sim.command({ type: "sails", ship: e.id, mast: "all", level: 4 });
    run(sim, 30);
    expect(Math.max(...e.ship!.mastLoad)).toBeGreaterThan(1);
    expect(Math.min(...e.ship!.mastHp)).toBeLessThan(e.ship!.model.def.mastHp);
  });

  it("is safe under reefed sails in the same gale", () => {
    const sim = new Simulation({ seed: 8, windDirection: Math.PI / 2, windSpeed: 22 });
    const e = sim.spawnShip({ classId: "brig", faction: "player", x: 0, z: 0, heading: 0 });
    sim.command({ type: "sails", ship: e.id, mast: "all", level: 1 });
    run(sim, 30);
    expect(Math.min(...e.ship!.mastHp)).toBeGreaterThan(e.ship!.model.def.mastHp * 0.95);
  });
});
