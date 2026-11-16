import { describe, expect, it } from "vitest";
import { generateArchipelago } from "@broadside/core";
import { Simulation, type SimulationOptions } from "../src/simulation";
import { restore, snapshot } from "../src/save/snapshot";
import { stateHash } from "../src/hash";

describe("save and restore", () => {
  it("continues exactly as the original after a round trip through JSON", () => {
    const archipelago = generateArchipelago(77);
    const opts: SimulationOptions = { seed: 77, windDirection: 0.8, windSpeed: 9, weather: "squally", archipelago };
    const a = new Simulation(opts);
    a.spawnShip({ classId: "brig", faction: "player", x: 0, z: 0, heading: 0.3, player: true, speed: 3 });
    a.spawnShip({ classId: "sloop", faction: "pirates", x: 300, z: 200, heading: 2, ai: true, speed: 3 });
    a.spawnFort({ x: 900, z: 0, y: 5, classId: "battery", faction: "crown", port: null });
    for (let i = 0; i < 60 * 20; i++) a.step();
    a.drainEvents();
    // No shots in flight at the save point (they are not part of a save).
    for (const e of [...a.world.with("shot")]) a.world.remove(e);
    const snap = JSON.parse(JSON.stringify(snapshot(a, opts)));
    const b = restore(snap, archipelago);
    expect(stateHash(b)).toBe(stateHash(a));
    for (let i = 0; i < 60 * 20; i++) {
      a.step();
      b.step();
    }
    expect(stateHash(b)).toBe(stateHash(a));
    expect(b.purse).toEqual(a.purse);
  });

  it("restores the sea itself, not only its wind", () => {
    const opts: SimulationOptions = { seed: 5, windDirection: 0, windSpeed: 12 };
    const a = new Simulation(opts);
    for (let i = 0; i < 60; i++) a.step();
    const b = restore(JSON.parse(JSON.stringify(snapshot(a, opts))), null);
    expect(b.env.waves).toEqual(a.env.waves);
  });
});
