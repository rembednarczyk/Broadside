import { describe, expect, it } from "vitest";
import { ASSIST, assistSpeed, rotateInv, wrapAngle, yawOf } from "@broadside/core";
import { Simulation } from "../src/simulation";
import { restore, snapshot } from "../src/save/snapshot";

const run = (sim: Simulation, seconds: number) => {
  for (let i = 0; i < seconds * 60; i++) sim.step();
};

const ahead = (sim: Simulation, id: number) => {
  const b = sim.byId(id)!.body!;
  return rotateInv(b.rot, b.vel).z;
};

// The wind blows towards +Z: a ship heading -Z (heading pi) is dead to windward.
const windward = (assist: boolean) => {
  const sim = new Simulation({ seed: 4, windDirection: 0, windSpeed: 8 });
  const e = sim.spawnShip({ classId: "galleon", faction: "player", x: 0, z: 0, heading: Math.PI });
  if (assist) sim.command({ type: "assist", ship: e.id, on: true });
  sim.command({ type: "course", ship: e.id, heading: Math.PI });
  run(sim, 60);
  return ahead(sim, e.id);
};

describe("assisted sailing", () => {
  it("makes her top speed dead to windward, where the sails alone cannot", () => {
    const top = assistSpeed(35, 1, 8);
    expect(windward(true)).toBeGreaterThan(top * 0.85);
    expect(windward(true)).toBeLessThan(top * 1.1);
    expect(windward(false)).toBeLessThan(1.5);
  });

  it("goes slower in light airs and astern with the sails backed", () => {
    const sim = new Simulation({ seed: 4, windDirection: 0, windSpeed: 1 });
    const e = sim.spawnShip({ classId: "sloop", faction: "player", x: 0, z: 0, heading: 1 });
    sim.command({ type: "assist", ship: e.id, on: true });
    run(sim, 50);
    expect(ahead(sim, e.id)).toBeGreaterThan(assistSpeed(22, 1, 1) * 0.85);
    expect(ahead(sim, e.id)).toBeLessThan(assistSpeed(22, 1, 8) * 0.8);
    sim.command({ type: "sails", ship: e.id, mast: "all", level: 0 });
    sim.command({ type: "assist", ship: e.id, on: true, astern: true });
    run(sim, 60);
    expect(ahead(sim, e.id)).toBeLessThan(-ASSIST.astern * 0.7);
  });

  it("turns on a circle of a few lengths with the helm hard over", () => {
    const sim = new Simulation({ seed: 5, windDirection: 0.7, windSpeed: 8 });
    const e = sim.spawnShip({ classId: "galleon", faction: "player", x: 0, z: 0, heading: 0 });
    sim.command({ type: "assist", ship: e.id, on: true });
    run(sim, 30);
    const before = yawOf(e.body!.rot);
    sim.command({ type: "helm", ship: e.id, rudder: 1 });
    run(sim, 10);
    const turned = wrapAngle(yawOf(e.body!.rot) - before);
    // About v / (1.2 L) rad/s once the wheel is over: a quarter turn and more in ten seconds.
    expect(turned).toBeGreaterThan(0.9);
    expect(turned).toBeLessThan(2.5);
    expect(Number.isFinite(e.body!.pos.x)).toBe(true);
  });

  it("is kept in a saved game", () => {
    const opts = { seed: 6, windDirection: 0, windSpeed: 8 };
    const sim = new Simulation(opts);
    const e = sim.spawnShip({ classId: "sloop", faction: "player", x: 0, z: 0, heading: 0 });
    sim.command({ type: "assist", ship: e.id, on: true, astern: true });
    sim.step();
    const back = restore(JSON.parse(JSON.stringify(snapshot(sim, opts))), null);
    expect(back.byId(e.id)!.assist).toEqual({ astern: true });
  });
});
