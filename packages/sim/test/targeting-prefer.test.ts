import { describe, expect, it } from "vitest";
import { Simulation } from "../src/simulation";
import { aimFor } from "../src/combat/targeting";

describe("a marked target (owner 22.11: a tap on a ship focuses her)", () => {
  it("lays the guns on the marked ship before a nearer one, when both bear", () => {
    const sim = new Simulation({ seed: 2, windDirection: 0, windSpeed: 4 });
    const me = sim.spawnShip({ classId: "frigate", faction: "player", x: 0, z: 0, heading: 0 });
    const near = sim.spawnShip({ classId: "sloop", faction: "pirates", x: 150, z: 0, heading: 0 });
    const far = sim.spawnShip({ classId: "brig", faction: "pirates", x: 300, z: 20, heading: 0 });
    expect(aimFor(me, sim.ships(), "starboard", true, sim.relations)!.target.id).toBe(near.id);
    expect(aimFor(me, sim.ships(), "starboard", true, sim.relations, far.id)!.target.id).toBe(far.id);
    // Out of the arc, the mark gives way to what bears.
    const astern = sim.spawnShip({ classId: "brig", faction: "pirates", x: 0, z: -300, heading: 0 });
    expect(aimFor(me, sim.ships(), "starboard", true, sim.relations, astern.id)!.target.id).toBe(near.id);
  });
});
