import { describe, expect, it } from "vitest";
import { type DomainEvent, generateArchipelago, portSites } from "@broadside/core";
import { Simulation } from "../src/simulation";

const run = (sim: Simulation, seconds: number, sink: DomainEvent[] = []) => {
  for (let i = 0; i < seconds * 60; i++) {
    sim.step();
    sink.push(...sim.drainEvents());
  }
  return sink;
};

const archipelago = generateArchipelago(1797);
const ports = portSites(archipelago);
const friendly = ports.findIndex((p) => p.faction !== "pirates");

const alongside = (sim: Simulation, port: number) => {
  const p = ports[port]!;
  const e = sim.spawnShip({ classId: "brig", faction: "player", x: p.ax, z: p.az, heading: 0, player: true });
  sim.command({ type: "sails", ship: e.id, mast: "all", level: 0 });
  return e;
};

describe("ports", () => {
  it("sells ammunition and hires crew alongside", () => {
    const sim = new Simulation({ seed: 2, windDirection: 0, windSpeed: 0, archipelago });
    const e = alongside(sim, friendly);
    e.ship!.crew -= 20;
    const gold = sim.purse.gold;
    sim.command({ type: "trade", ship: e.id, port: friendly, service: "ammo", ammo: "chain", qty: 10 });
    sim.command({ type: "trade", ship: e.id, port: friendly, service: "crew", qty: 50 });
    run(sim, 0.1);
    expect(e.ship!.stores.chain).toBe(22);
    expect(e.ship!.crew).toBe(e.ship!.model.def.crew);
    expect(sim.purse.gold).toBeLessThan(gold);
  });

  it("refuses a ship far from the quay", () => {
    const sim = new Simulation({ seed: 2, windDirection: 0, windSpeed: 0, archipelago });
    const p = ports[friendly]!;
    const e = sim.spawnShip({ classId: "brig", faction: "player", x: p.ax + 600, z: p.az, heading: 0, player: true });
    sim.command({ type: "trade", ship: e.id, port: friendly, service: "crew", qty: 5 });
    expect(run(sim, 0.1).some((x) => x.type === "tradeRefused")).toBe(true);
  });

  it("repairs the hull, masts, canvas and rigging for gold", () => {
    const sim = new Simulation({ seed: 2, windDirection: 0, windSpeed: 0, archipelago });
    const e = alongside(sim, friendly);
    e.ship!.sections[0]!.hp = 10;
    e.ship!.rigging = 0.5;
    sim.command({ type: "trade", ship: e.id, port: friendly, service: "repair", qty: 1 });
    run(sim, 0.1);
    expect(e.ship!.sections[0]!.hp).toBe(e.ship!.model.def.sectionHp);
    expect(e.ship!.rigging).toBe(1);
  });

  it("pays prize money for a ship the player sinks", () => {
    const sim = new Simulation({ seed: 2, windDirection: 0, windSpeed: 0 });
    const me = sim.spawnShip({ classId: "brig", faction: "player", x: 0, z: 0, heading: 0, player: true });
    const prey = sim.spawnShip({ classId: "sloop", faction: "pirates", x: 300, z: 0, heading: 0 });
    prey.ship!.lastHitBy = me.id;
    for (const s of prey.ship!.sections) s.leak = 2;
    const before = sim.purse.gold;
    const ev = run(sim, 80);
    expect(ev.some((x) => x.type === "gold" && x.reason === "prize")).toBe(true);
    expect(sim.purse.gold).toBeGreaterThan(before);
    expect(sim.purse.plunder).toBeGreaterThan(0);
  });
});
