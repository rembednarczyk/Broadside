import { describe, expect, it } from "vitest";
import { type DomainEvent, SALVAGE, generateArchipelago, salvageGold, wreckSites } from "@broadside/core";
import { Simulation } from "../src/simulation";
import { restore, snapshot } from "../src/save/snapshot";

const map = generateArchipelago(5);
const wreck = wreckSites(map)[0]!;
const opts = { seed: 5, windDirection: 0, windSpeed: 4, archipelago: map };
const beside = (speed = 0) => {
  const sim = new Simulation(opts);
  const me = sim.spawnShip({ classId: "sloop", faction: "player", x: wreck.x + 25, z: wreck.z, heading: 0, speed, player: true });
  return { sim, me };
};
const run = (sim: Simulation, seconds: number): DomainEvent[] => {
  const out: DomainEvent[] = [];
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    sim.step();
    out.push(...sim.drainEvents());
  }
  return out;
};
const hauls = (ev: readonly DomainEvent[]) => ev.filter((e) => e.type === "gold" && e.reason === "wreck");

describe("salvage", () => {
  it("brings a wreck's gold aboard once, after lying to beside it", () => {
    const { sim } = beside();
    const gold = sim.purse.gold;
    const first = hauls(run(sim, SALVAGE.dwell + 1.5));
    expect(first).toHaveLength(1);
    expect(sim.purse.gold - gold).toBe(salvageGold(5, 0));
    expect(hauls(run(sim, SALVAGE.dwell + 1.5))).toHaveLength(0);
  });

  it("pays the same in every game of the seed, between the table's bounds", () => {
    expect(salvageGold(5, 0)).toBe(salvageGold(5, 0));
    for (let i = 0; i < 20; i++) {
      const g = salvageGold(5, i);
      expect(g).toBeGreaterThanOrEqual(SALVAGE.gold[0]);
      expect(g).toBeLessThanOrEqual(SALVAGE.gold[1]);
    }
  });

  it("gives nothing to a ship sailing past", () => {
    const { sim } = beside(6);
    expect(hauls(run(sim, SALVAGE.dwell + 1.5))).toHaveLength(0);
  });

  it("keeps the salvaged wrecks through a save", () => {
    const { sim } = beside();
    run(sim, SALVAGE.dwell + 1.5);
    const back = restore(JSON.parse(JSON.stringify(snapshot(sim, opts))), map);
    expect(back.salvage.salvaged).toEqual([0]);
    expect(hauls(run(back, SALVAGE.dwell + 1.5))).toHaveLength(0);
  });
});
