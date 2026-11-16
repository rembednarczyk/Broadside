import { describe, expect, it } from "vitest";
import { type DomainEvent } from "@broadside/core";
import { Simulation } from "../src/simulation";
import { segmentHit, rigBox } from "../src/combat/hit-test";
import { vec3 } from "@broadside/core";

const run = (sim: Simulation, seconds: number, sink: DomainEvent[] = []) => {
  for (let i = 0; i < seconds * 60; i++) {
    sim.step();
    sink.push(...sim.drainEvents());
  }
  return sink;
};

describe("gunnery", () => {
  it("fires a rolling broadside that hits a ship lying abeam", () => {
    const sim = new Simulation({ seed: 5, windDirection: 0, windSpeed: 4 });
    const a = sim.spawnShip({ classId: "brig", faction: "player", x: 0, z: 0, heading: 0 });
    const b = sim.spawnShip({ classId: "brig", faction: "pirates", x: 150, z: 0, heading: 0 });
    sim.command({ type: "sails", ship: a.id, mast: "all", level: 0 });
    sim.command({ type: "sails", ship: b.id, mast: "all", level: 0 });
    run(sim, 2);
    sim.command({ type: "fire", ship: a.id, mount: "broadside", side: "starboard", range: 150 });
    const ev = run(sim, 4);
    const fired = ev.filter((e) => e.type === "gunFired");
    const hits = ev.filter((e) => e.type === "hit" && e.ship === b.id);
    expect(fired).toHaveLength(9);
    expect(hits.length).toBeGreaterThanOrEqual(5);
    expect(b.ship!.sections.some((s) => s.hp < b.ship!.model.def.sectionHp)).toBe(true);
    // Reloading: a second order right away fires nothing.
    sim.command({ type: "fire", ship: a.id, mount: "broadside", side: "starboard", range: 150 });
    expect(run(sim, 0.5).filter((e) => e.type === "gunFired")).toHaveLength(0);
    expect(a.ship!.stores.round).toBe(40 * a.ship!.model.def.guns.length - 9);
  });

  it("does not fire while braced", () => {
    const sim = new Simulation({ seed: 5, windDirection: 0, windSpeed: 4 });
    const a = sim.spawnShip({ classId: "sloop", faction: "player", x: 0, z: 0, heading: 0 });
    sim.command({ type: "brace", ship: a.id });
    sim.command({ type: "fire", ship: a.id, mount: "broadside", side: "port", range: 100 });
    expect(run(sim, 1).filter((e) => e.type === "gunFired")).toHaveLength(0);
  });

  it("tears sails with chain shot more than with round shot", () => {
    const cloth = (ammo: "round" | "chain") => {
      const sim = new Simulation({ seed: 9, windDirection: 0, windSpeed: 4 });
      const a = sim.spawnShip({ classId: "frigate", faction: "player", x: 0, z: 0, heading: 0 });
      const b = sim.spawnShip({ classId: "brig", faction: "pirates", x: 120, z: 0, heading: 0 });
      for (const e of [a, b]) sim.command({ type: "sails", ship: e.id, mast: "all", level: 0 });
      sim.command({ type: "loadAmmo", ship: a.id, mount: "broadside", ammo });
      run(sim, 20);
      // Aim high enough for the rig: chain is fired at long range so it climbs into the masts.
      sim.command({ type: "fire", ship: a.id, mount: "broadside", side: "starboard", range: 260 });
      run(sim, 5);
      return b.ship!.sailCloth.reduce((x, y) => x + y, 0) + b.ship!.rigging;
    };
    expect(cloth("chain")).toBeLessThan(cloth("round"));
  });
});

describe("hit test", () => {
  it("finds the hull and misses beside it", () => {
    const sim = new Simulation({ seed: 1, windDirection: 0, windSpeed: 0 });
    const e = sim.spawnShip({ classId: "brig", faction: "player", x: 0, z: 0, heading: 0 });
    const m = e.ship!.model;
    const hit = segmentHit(e.body!, m, rigBox(m), vec3(20, 1, 0), vec3(0, 1, 0));
    expect(hit?.where).toBe("hull");
    expect(hit!.local.x).toBeCloseTo(m.def.hull.beam / 2, 0);
    expect(segmentHit(e.body!, m, rigBox(m), vec3(20, 1, 40), vec3(0, 1, 40))).toBeNull();
    expect(segmentHit(e.body!, m, rigBox(m), vec3(20, 15, 0), vec3(-20, 15, 0))?.where).toBe("rig");
  });
});

describe("damage control and sinking", () => {
  it("floods through a hole below the waterline and pumps it out", () => {
    const sim = new Simulation({ seed: 1, windDirection: 0, windSpeed: 0 });
    const e = sim.spawnShip({ classId: "sloop", faction: "player", x: 0, z: 0, heading: 0 });
    e.ship!.sections[2]!.leak = 0.05;
    run(sim, 20);
    expect(e.ship!.sections[2]!.water).toBeGreaterThan(0);
    expect(e.ship!.sections[2]!.leak).toBeLessThan(0.05);
    expect(e.ship!.sinking).toBe(false);
  });

  it("sinks a holed ship, throws men overboard and removes the wreck", () => {
    const sim = new Simulation({ seed: 1, windDirection: 0, windSpeed: 0 });
    const e = sim.spawnShip({ classId: "sloop", faction: "pirates", x: 0, z: 0, heading: 0 });
    for (const s of e.ship!.sections) s.leak = 2;
    const ev = run(sim, 80);
    expect(ev.some((x) => x.type === "shipSinking")).toBe(true);
    expect(ev.some((x) => x.type === "crewOverboard")).toBe(true);
    expect(ev.some((x) => x.type === "shipSunk")).toBe(true);
    expect(sim.ships().some((x) => x.id === e.id)).toBe(false);
  });

  it("lets a ship pick up men in the water", () => {
    const sim = new Simulation({ seed: 1, windDirection: 0, windSpeed: 0 });
    const e = sim.spawnShip({ classId: "brig", faction: "player", x: 0, z: 0, heading: 0 });
    e.ship!.crew -= 10;
    sim.world.add({ id: 0, castaway: { x: 8, z: 0, count: 6, from: 99, age: 0 } });
    const ev = run(sim, 1);
    expect(ev.some((x) => x.type === "crewRescued")).toBe(true);
    expect(e.ship!.crew).toBe(e.ship!.model.def.crew - 4);
  });
});

describe("AI captain", () => {
  it("engages a hostile ship and damages it", () => {
    const sim = new Simulation({ seed: 21, windDirection: 1.4, windSpeed: 8 });
    const pirate = sim.spawnShip({ classId: "brig", faction: "pirates", x: 0, z: 0, heading: 0, ai: true, speed: 3 });
    const prey = sim.spawnShip({ classId: "sloop", faction: "crown", x: 300, z: 200, heading: 2, speed: 3 });
    sim.command({ type: "sails", ship: prey.id, mast: "all", level: 1 });
    const ev = run(sim, 120);
    expect(pirate.captain!.mode === "engage" || pirate.captain!.mode === "patrol").toBe(true);
    expect(ev.filter((x) => x.type === "gunFired" && x.ship === pirate.id).length).toBeGreaterThan(5);
    expect(ev.filter((x) => x.type === "hit" && x.ship === prey.id).length).toBeGreaterThan(0);
  });

  it("leaves friends alone", () => {
    const sim = new Simulation({ seed: 21, windDirection: 1.4, windSpeed: 8 });
    sim.spawnShip({ classId: "brig", faction: "crown", x: 0, z: 0, heading: 0, ai: true });
    sim.spawnShip({ classId: "sloop", faction: "player", x: 200, z: 0, heading: 0 });
    expect(run(sim, 30).filter((x) => x.type === "gunFired")).toHaveLength(0);
  });
});
