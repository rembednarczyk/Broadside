import { describe, expect, it } from "vitest";
import { Simulation } from "../src/simulation";

const topSpeed = (fun: boolean): number => {
  const sim = new Simulation({ seed: 2, windDirection: 0, windSpeed: 9 });
  const e = sim.spawnShip({ classId: "galleon", faction: "player", x: 0, z: 0, heading: 1.2, player: true });
  sim.command({ type: "assist", ship: e.id, on: true, fun });
  sim.command({ type: "sails", ship: e.id, mast: "all", level: 3 });
  for (let i = 0; i < 60 * 60; i++) sim.step();
  return Math.hypot(e.body!.vel.x, e.body!.vel.z);
};

describe("the Fun mode", () => {
  it("sails much faster than assisted sailing", () => {
    const action = topSpeed(false);
    const fun = topSpeed(true);
    expect(fun).toBeGreaterThan(action * 1.5);
  });

  it("reloads the guns in a fraction of the time", () => {
    const reload = (fun: boolean): number => {
      const sim = new Simulation({ seed: 2, windDirection: 0, windSpeed: 5 });
      const e = sim.spawnShip({ classId: "brig", faction: "player", x: 0, z: 0, heading: 0, player: true });
      sim.command({ type: "assist", ship: e.id, on: true, fun });
      sim.command({ type: "fire", ship: e.id, mount: "broadside", side: "port", range: 150 });
      for (let i = 0; i < 60 * 3; i++) sim.step();
      return Math.max(...e.ship!.guns.filter((g) => g.reload > 0).map((g) => g.reload));
    };
    expect(reload(true)).toBeLessThan(reload(false) * 0.5);
  });

  it("keeps the mode when going astern", () => {
    const sim = new Simulation({ seed: 2, windDirection: 0, windSpeed: 5 });
    const e = sim.spawnShip({ classId: "brig", faction: "player", x: 0, z: 0, heading: 0, player: true });
    sim.command({ type: "assist", ship: e.id, on: true, fun: true });
    sim.step();
    sim.command({ type: "assist", ship: e.id, on: true, astern: true });
    sim.step();
    expect(e.assist!.fun).toBe(true);
  });
});
