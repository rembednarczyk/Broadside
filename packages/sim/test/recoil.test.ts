import { describe, expect, it } from "vitest";
import { rollOf } from "@broadside/core";
import { Simulation } from "../src/simulation";

const heelAfterBroadside = (side: "port" | "starboard"): number => {
  const sim = new Simulation({ seed: 1, windDirection: 0, windSpeed: 0.1 });
  const e = sim.spawnShip({ classId: "frigate", faction: "player", x: 0, z: 0, heading: 0, player: true });
  e.ship!.sailTarget = e.ship!.sailTarget.map(() => 0);
  e.ship!.sailSet = e.ship!.sailSet.map(() => 0);
  for (let i = 0; i < 600; i++) sim.step();
  const r0 = rollOf(e.body!.rot);
  sim.command({ type: "fire", ship: e.id, mount: "broadside", side, range: 200 });
  let peak = 0;
  for (let i = 0; i < 300; i++) {
    sim.step();
    const d = rollOf(e.body!.rot) - r0;
    if (Math.abs(d) > Math.abs(peak)) peak = d;
  }
  return peak;
};

describe("recoil", () => {
  it("heels the ship away from the side that fired, by a degree or two", () => {
    const starboard = heelAfterBroadside("starboard");
    const port = heelAfterBroadside("port");
    // rollOf < 0: the starboard side rises (heeled to port).
    expect(starboard).toBeLessThan(0);
    expect(port).toBeGreaterThan(0);
    expect(Math.abs(starboard) * 57.3).toBeGreaterThan(1);
    expect(Math.abs(starboard) * 57.3).toBeLessThan(5);
  });
});
