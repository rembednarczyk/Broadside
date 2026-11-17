import { describe, expect, it } from "vitest";
import { type DomainEvent, type FortSite, quatFromYaw, vec3 } from "@broadside/core";
import { Simulation } from "../src/simulation";

const run = (sim: Simulation, seconds: number, sink: DomainEvent[] = []) => {
  for (let i = 0; i < seconds * 60; i++) {
    sim.step();
    sink.push(...sim.drainEvents());
  }
  return sink;
};

const site = (classId: FortSite["classId"], faction: FortSite["faction"]): FortSite => ({ x: 0, z: 0, y: 6, classId, faction, port: null });

describe("forts", () => {
  it("fires on a hostile ship in range and hits her", () => {
    const sim = new Simulation({ seed: 4, windDirection: 0, windSpeed: 3 });
    sim.spawnFort(site("battery", "crown"));
    const ship = sim.spawnShip({ classId: "brig", faction: "pirates", x: 260, z: 0, heading: 0 });
    sim.command({ type: "sails", ship: ship.id, mast: "all", level: 0 });
    const ev = run(sim, 40);
    expect(ev.filter((e) => e.type === "gunFired").length).toBeGreaterThan(4);
    expect(ev.some((e) => e.type === "hit" && e.ship === ship.id)).toBe(true);
  });

  it("leaves friends alone until provoked", () => {
    const sim = new Simulation({ seed: 4, windDirection: 0, windSpeed: 3 });
    sim.spawnFort(site("battery", "crown"));
    sim.spawnShip({ classId: "brig", faction: "player", x: 260, z: 0, heading: 0 });
    expect(run(sim, 20).filter((e) => e.type === "gunFired")).toHaveLength(0);
  });

  it("is silenced by gunfire and taken by a landing party", () => {
    const sim = new Simulation({ seed: 4, windDirection: 0, windSpeed: 3 });
    const fort = sim.spawnFort(site("watchtower", "pirates"));
    const ship = sim.spawnShip({ classId: "frigate", faction: "player", x: 0, z: -170, heading: Math.PI / 2 });
    sim.command({ type: "sails", ship: ship.id, mast: "all", level: 0 });
    const ev: DomainEvent[] = [];
    ship.ship!.stores.round = 1000;
    for (let k = 0; k < 20 && !fort.fort!.silenced; k++) {
      // Lying at anchor, broadside on: the test pins her heading each round (in play the player manoeuvres).
      ship.body!.rot = quatFromYaw(Math.PI / 2);
      ship.body!.angVel = vec3(0, 0, 0);
      sim.command({ type: "fire", ship: ship.id, mount: "broadside", side: "port", range: 170, bearing: 0, aimHeight: 12 });
      run(sim, 25, ev);
    }
    expect(fort.fort!.silenced).toBe(true);
    expect(ev.some((e) => e.type === "fortSilenced")).toBe(true);
    sim.command({ type: "assault", ship: ship.id, fort: fort.id });
    run(sim, 1, ev);
    expect(ev.some((e) => e.type === "fortCaptured")).toBe(true);
    expect(fort.fort!.faction).toBe("player");
  });

  it("repels a weak storming party", () => {
    const sim = new Simulation({ seed: 4, windDirection: 0, windSpeed: 3 });
    const fort = sim.spawnFort(site("citadel", "crown"));
    fort.fort!.silenced = true;
    const ship = sim.spawnShip({ classId: "cutter", faction: "player", x: 0, z: -120, heading: 0 });
    sim.command({ type: "assault", ship: ship.id, fort: fort.id });
    const ev = run(sim, 1);
    expect(ev.some((e) => e.type === "assaultFailed")).toBe(true);
    expect(fort.fort!.faction).toBe("crown");
  });
});

describe("sieges by the navies", () => {
  it("a man-of-war bombards the fort of a nation at war with hers", () => {
    const sim = new Simulation({ seed: 9, windDirection: Math.PI / 2, windSpeed: 7 });
    const fort = sim.spawnFort(site("watchtower", "republic"));
    const frigate = sim.spawnShip({ classId: "frigate", faction: "crown", x: 0, z: -600, heading: 0, ai: true, speed: 3 });
    frigate.ship!.stores.round = 1000;
    const ev = run(sim, 240);
    expect(ev.some((e) => e.type === "gunFired" && e.ship === frigate.id)).toBe(true);
    expect(ev.some((e) => e.type === "hit" && e.ship === fort.id)).toBe(true);
  });

  it("leaves a friendly fort alone", () => {
    const sim = new Simulation({ seed: 9, windDirection: Math.PI / 2, windSpeed: 7 });
    sim.spawnFort(site("watchtower", "crown"));
    const frigate = sim.spawnShip({ classId: "frigate", faction: "crown", x: 0, z: -600, heading: 0, ai: true, speed: 3 });
    expect(run(sim, 60).some((e) => e.type === "gunFired" && e.ship === frigate.id)).toBe(false);
  });
});
