import { describe, expect, it } from "vitest";
import { Simulation } from "../src/simulation";

const run = (sim: Simulation, seconds: number) => {
  for (let i = 0; i < seconds * 60; i++) sim.step();
};

describe("anchoring", () => {
  it("brings a ship under way up to her anchor and holds her there in a breeze", () => {
    const sim = new Simulation({ seed: 3, windDirection: 0.5, windSpeed: 9 });
    const e = sim.spawnShip({ classId: "brig", faction: "player", x: 0, z: 0, heading: 0.5 });
    run(sim, 40);
    expect(Math.hypot(e.body!.vel.x, e.body!.vel.z)).toBeGreaterThan(2);
    sim.command({ type: "sails", ship: e.id, mast: "all", level: 0 });
    sim.command({ type: "anchor", ship: e.id, down: true });
    sim.step();
    const a = { ...e.anchor! };
    run(sim, 60);
    expect(Math.hypot(e.body!.vel.x, e.body!.vel.z)).toBeLessThan(0.6);
    expect(Math.hypot(e.body!.pos.x - a.x, e.body!.pos.z - a.z)).toBeLessThan(60);
  });

  it("making sail weighs the anchor", () => {
    const sim = new Simulation({ seed: 3, windDirection: 0.5, windSpeed: 9 });
    const e = sim.spawnShip({ classId: "brig", faction: "player", x: 0, z: 0, heading: 0.5 });
    sim.command({ type: "anchor", ship: e.id, down: true });
    sim.step();
    expect(e.anchor).toBeDefined();
    sim.command({ type: "sails", ship: e.id, mast: "all", level: 3 });
    sim.step();
    expect(e.anchor).toBeUndefined();
  });
});
