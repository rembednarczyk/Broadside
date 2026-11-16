import { describe, expect, it } from "vitest";
import { type DomainEvent } from "@broadside/core";
import { Simulation } from "../src/simulation";

const run = (sim: Simulation, seconds: number, sink: DomainEvent[] = []) => {
  for (let i = 0; i < seconds * 60; i++) {
    sim.step();
    sink.push(...sim.drainEvents());
  }
  return sink;
};

describe("ship collisions", () => {
  it("keeps hulls apart and rams with the stem", () => {
    const sim = new Simulation({ seed: 6, windDirection: 0, windSpeed: 0 });
    // A frigate driving at 6 m/s straight into a sloop's beam.
    const ram = sim.spawnShip({ classId: "frigate", faction: "player", x: 0, z: -60, heading: 0, speed: 6 });
    const victim = sim.spawnShip({ classId: "sloop", faction: "pirates", x: 0, z: 0, heading: Math.PI / 2 });
    const ev = run(sim, 15);
    const hits = ev.filter((e) => e.type === "collision");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((e) => e.type === "collision" && e.ram)).toBe(true);
    const lost = (s: typeof victim) => s.ship!.sections.reduce((a, x) => a + (s.ship!.model.def.sectionHp - x.hp), 0) / s.ship!.model.def.sectionHp;
    expect(lost(victim)).toBeGreaterThan(lost(ram));
    expect(Math.hypot(ram.body!.pos.x - victim.body!.pos.x, ram.body!.pos.z - victim.body!.pos.z)).toBeGreaterThan(4);
    expect(victim.ship!.lastHitBy).toBe(ram.id);
  });
});
