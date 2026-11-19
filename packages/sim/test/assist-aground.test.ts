import { describe, expect, it } from "vitest";
import { generateArchipelago } from "@broadside/core";
import { Simulation } from "../src/simulation";
import { hullShare } from "../src/ship/ship-state";

describe("assisted sailing aground", () => {
  const archipelago = generateArchipelago(1797);
  const is = archipelago.islands.find((i) => i.kind === "beach" && i.form === "island" && !i.spine)!;

  it("stops driving her onto the shoal, and going astern backs her off", () => {
    const sim = new Simulation({ seed: 3, windDirection: 0, windSpeed: 9, archipelago });
    // Running straight for the island at full canvas under the action controls.
    const e = sim.spawnShip({ classId: "galleon", faction: "player", x: is.x - is.radius - is.shoal - 250, z: is.z, heading: Math.PI / 2, speed: 6, player: true });
    sim.command({ type: "assist", ship: e.id, on: true, astern: false });
    sim.command({ type: "sails", ship: e.id, mast: "all", level: 4 });
    let grounded = false;
    for (let i = 0; i < 60 * 90; i++) {
      sim.step();
      grounded ||= e.ship!.aground;
    }
    expect(grounded).toBe(true);
    // The hull survives the grounding (before: 92% to 18% while the drive pushed on).
    expect(hullShare(e.ship!)).toBeGreaterThan(0.6);
    // Astern: furled and backed.
    sim.command({ type: "sails", ship: e.id, mast: "all", level: 0 });
    sim.command({ type: "assist", ship: e.id, on: true, astern: true });
    for (let i = 0; i < 60 * 90 && e.ship!.aground; i++) sim.step();
    for (let i = 0; i < 60 * 5; i++) sim.step();
    expect(e.ship!.aground).toBe(false);
  });
});
