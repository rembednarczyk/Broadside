import { describe, expect, it } from "vitest";
import { generateArchipelago } from "@broadside/core";
import { Simulation } from "../src/simulation";

describe("a ship stranded", () => {
  const archipelago = generateArchipelago(1797);
  const is = archipelago.islands.find((i) => i.kind === "beach" && i.form === "island" && !i.spine)!;

  it("under an AI captain takes in sail and does not go down unhit", () => {
    const sim = new Simulation({ seed: 3, windDirection: Math.PI / 2, windSpeed: 12, archipelago });
    // Running before a fresh wind straight onto the island, under full sail.
    const e = sim.spawnShip({ classId: "frigate", faction: "crown", x: is.x - is.radius - is.shoal - 200, z: is.z, heading: Math.PI / 2, speed: 6, ai: true });
    e.captain!.wx = is.x;
    e.captain!.wz = is.z;
    sim.command({ type: "sails", ship: e.id, mast: "all", level: 3 });
    let aground = false;
    for (let i = 0; i < 60 * 180; i++) {
      sim.step();
      aground ||= e.ship!.aground;
    }
    if (aground) expect(e.ship!.sailTarget.every((l) => l === 0) || !e.ship!.aground).toBe(true);
    expect(e.ship!.sinking).toBe(false);
  });
});
