import { describe, expect, it } from "vitest";
import { Simulation } from "../src/simulation";

describe("the crew's reefing", () => {
  it("holds the canvas to reefed sails in a gale whatever the masts' load, and sets it again when it blows less", () => {
    const sim = new Simulation({ seed: 4, windDirection: 0, windSpeed: 22 });
    const e = sim.spawnShip({ classId: "galleon", faction: "player", x: 0, z: 0, heading: 2.4, player: true, speed: 5 });
    sim.command({ type: "sails", ship: e.id, mast: "all", level: 3 });
    sim.command({ type: "crew", ship: e.id, reef: true });
    const levels: number[] = [];
    for (let i = 0; i < 60 * 40; i++) {
      sim.step();
      if (i > 60 * 10) levels.push(Math.max(...e.ship!.sailTarget));
    }
    expect(Math.max(...levels)).toBeLessThanOrEqual(1);
    sim.env.windSpeed = 8;
    for (let i = 0; i < 60 * 60; i++) sim.step();
    expect(Math.max(...e.ship!.sailTarget)).toBeGreaterThan(1);
  });
});
