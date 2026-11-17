import { describe, expect, it } from "vitest";
import { type GameCommand } from "@broadside/core";
import { Simulation } from "../src/simulation";
import { stateHash } from "../src/hash";

/** A fixed voyage: two ships, a command log, one minute of sailing. */
const voyage = (): string => {
  const sim = new Simulation({ seed: 1234, windDirection: 1.2, windSpeed: 9 });
  const a = sim.spawnShip({ classId: "sloop", faction: "player", x: 0, z: 0, heading: 0, player: true });
  const b = sim.spawnShip({ classId: "brig", faction: "pirates", x: 120, z: 80, heading: 2 });
  const log: [number, GameCommand][] = [
    [60, { type: "helm", ship: a.id, rudder: 0.6 }],
    [300, { type: "sails", ship: b.id, mast: "all", level: 2 }],
    [900, { type: "helm", ship: a.id, rudder: -0.3 }],
    [1500, { type: "sails", ship: a.id, mast: 0, level: 4 }],
  ];
  for (let i = 0; i < 3600; i++) {
    for (const [at, c] of log) if (at === i) sim.command(c);
    sim.step();
  }
  return stateHash(sim);
};

describe("determinism", () => {
  it("replays the same voyage to the same state", () => {
    expect(voyage()).toBe(voyage());
  });

  it("matches the golden hash (update by hand only, naming the rule that changed it)", () => {
    expect(voyage()).toMatchInlineSnapshot(`"81d3dd8a"`);
  });
});
