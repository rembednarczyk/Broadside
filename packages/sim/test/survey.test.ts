import { describe, expect, it } from "vitest";
import { generateArchipelago, surveyIndex } from "@broadside/core";
import { Simulation } from "../src/simulation";
import { restore, snapshot } from "../src/save/snapshot";

describe("the lookout's survey", () => {
  const archipelago = generateArchipelago(7);
  const opts = { seed: 7, windDirection: 1.1, windSpeed: 8, archipelago };

  it("charts the sea round the player's ship as she sails, and keeps it", () => {
    const sim = new Simulation(opts);
    const me = sim.spawnShip({ classId: "brig", faction: "player", x: 0, z: 0, heading: 0, player: true, speed: 4 });
    for (let i = 0; i < 60; i++) sim.step();
    expect(sim.survey.seen).toContain(surveyIndex(archipelago, 0, 0));
    expect(sim.survey.seen).not.toContain(surveyIndex(archipelago, 2500, 0));
    const before = sim.survey.seen.length;
    me.body!.pos = { ...me.body!.pos, x: 1800 };
    for (let i = 0; i < 90; i++) sim.step();
    expect(sim.survey.seen).toContain(surveyIndex(archipelago, 2500, 0));
    expect(sim.survey.seen).toContain(surveyIndex(archipelago, 0, 0));
    expect(sim.survey.seen.length).toBeGreaterThan(before);
    expect([...sim.survey.seen].sort((p, q) => p - q)).toEqual(sim.survey.seen);
    const b = restore(JSON.parse(JSON.stringify(snapshot(sim, opts))), archipelago);
    expect(b.survey.seen).toEqual(sim.survey.seen);
  });
});
