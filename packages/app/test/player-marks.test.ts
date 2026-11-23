import { describe, expect, it } from "vitest";
import { Simulation } from "@broadside/sim";
import { PlayerMarks } from "../src/player-marks";

describe("player marks", () => {
  it("marks a ship with a tap, clears it with the same tap, and lets it go when she strikes", () => {
    const sim = new Simulation({ seed: 2, windDirection: 0, windSpeed: 4 });
    const ship = sim.spawnShip({ classId: "sloop", faction: "pirates", x: 100, z: 0, heading: 0 });
    const m = new PlayerMarks(sim);
    m.toggleFocus(ship.id);
    expect(m.marked()).toBe(ship.id);
    m.toggleFocus(ship.id);
    expect(m.marked()).toBeNull();
    m.toggleFocus(ship.id);
    ship.ship!.struck = true;
    expect(m.marked()).toBeNull();
  });
});
