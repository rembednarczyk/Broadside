import { describe, expect, it } from "vitest";
import { DEEP_SEA, fortSites, generateArchipelago, terrainHeight } from "@broadside/core";
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

  it("moves the ships of a save from an older world off the new land and rebuilds its forts", () => {
    const archipelago = generateArchipelago(77);
    const a = new Simulation({ seed: 77, windDirection: 0.8, windSpeed: 9, archipelago });
    // A ship where the new land stands (the mainland's centre is ashore), and an old fort.
    const main = archipelago.islands.find((i) => i.form === "mainland")!;
    const inland = { x: main.x * 0.85, z: main.z * 0.85 };
    expect(terrainHeight(archipelago, inland.x, inland.z)).toBeGreaterThan(0);
    a.spawnShip({ classId: "brig", faction: "player", x: inland.x, z: inland.z, heading: 0, player: true });
    a.spawnFort({ x: 900, z: 0, y: 5, classId: "battery", faction: "crown", port: null });
    a.salvage.salvaged.push(3);
    const snap = JSON.parse(JSON.stringify(snapshot(a, { seed: 77, windDirection: 0.8, windSpeed: 9, archipelago })));
    delete snap.options.world;
    const b = restore(snap, archipelago);
    const p = b.player()!.body!.pos;
    expect(terrainHeight(archipelago, p.x, p.z)).toBe(DEEP_SEA);
    expect(b.forts().map((f) => f.fort!.site)).toEqual(fortSites(archipelago));
    expect(b.salvage.salvaged).toEqual([]);
    // A save from this world keeps everything as it was.
    const c = restore(JSON.parse(JSON.stringify(snapshot(a, { seed: 77, windDirection: 0.8, windSpeed: 9, archipelago }))), archipelago);
    expect(c.player()!.body!.pos.x).toBeCloseTo(inland.x);
    expect(c.forts()).toHaveLength(1);
  });
});
