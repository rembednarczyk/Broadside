import { describe, expect, it } from "vitest";
import { type DomainEvent, generateArchipelago, terrainHeight } from "@broadside/core";
import { Simulation } from "../src/simulation";

const run = (sim: Simulation, seconds: number, sink: DomainEvent[] = []) => {
  for (let i = 0; i < seconds * 60; i++) {
    sim.step();
    sink.push(...sim.drainEvents());
  }
  return sink;
};

describe("islands", () => {
  const archipelago = generateArchipelago(1797);
  const is = archipelago.islands.find((i) => i.kind === "beach") ?? archipelago.islands[0]!;

  it("runs a ship aground on a shoal and holes her bottom", () => {
    const sim = new Simulation({ seed: 3, windDirection: 0, windSpeed: 9, archipelago });
    // Start 450 m off the island's centre, heading straight for it with the wind behind.
    const heading = Math.atan2(is.x - (is.x - 450), is.z - is.z);
    const e = sim.spawnShip({ classId: "brig", faction: "player", x: is.x - 450, z: is.z, heading, speed: 5 });
    sim.command({ type: "course", ship: e.id, heading });
    const ev = run(sim, 120);
    expect(ev.some((x) => x.type === "grounded")).toBe(true);
    expect(e.ship!.sections.some((s) => s.leak > 0 || s.hp < e.ship!.model.def.sectionHp)).toBe(true);
    // She is held on the shoal: not inside the island.
    expect(terrainHeight(archipelago, e.body!.pos.x, e.body!.pos.z)).toBeLessThan(2);
  });

  it("makes an AI captain steer around land", () => {
    const sim = new Simulation({ seed: 3, windDirection: Math.PI / 2, windSpeed: 9, archipelago });
    const e = sim.spawnShip({ classId: "sloop", faction: "pirates", x: is.x - 600, z: is.z, heading: Math.PI / 2, speed: 4, ai: true });
    e.captain!.wx = is.x + 900;
    e.captain!.wz = is.z;
    const ev = run(sim, 240);
    expect(ev.filter((x) => x.type === "grounded" && x.ship === e.id)).toHaveLength(0);
  });
});
