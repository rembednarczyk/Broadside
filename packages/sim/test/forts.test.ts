import { describe, expect, it } from "vitest";
import { type DomainEvent, type FortSite, createRng, quatFromYaw, vec3 } from "@broadside/core";
import { Simulation } from "../src/simulation";
import { damageFort, stormChance } from "../src/combat/forts";

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
    // In front of the rampart (a battery's guns bear 60 deg either side of their embrasures).
    const ship = sim.spawnShip({ classId: "brig", faction: "pirates", x: 0, z: 260, heading: Math.PI / 2 });
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

describe("fort gunnery and silencing (beta test 22.11)", () => {
  it("fires by divisions from its embrasures, not all at once from one point", () => {
    const sim = new Simulation({ seed: 4, windDirection: 0, windSpeed: 3 });
    const fort = sim.spawnFort(site("starFort", "crown"));
    sim.spawnShip({ classId: "brig", faction: "pirates", x: 0, z: 300, heading: Math.PI / 2 });
    const fired: { t: number; x: number; z: number }[] = [];
    for (let i = 0; i < 20 * 60; i++) {
      sim.step();
      for (const e of sim.drainEvents()) if (e.type === "gunFired" && e.ship === fort.id && e.ammo !== "shell") fired.push({ t: i / 60, x: e.at.x, z: e.at.z });
    }
    expect(fired.length).toBeGreaterThan(5);
    // No two guns in one frame, and from more than one embrasure, all on the side facing the ship.
    expect(new Set(fired.map((f) => f.t)).size).toBe(fired.length);
    expect(new Set(fired.map((f) => `${f.x.toFixed(1)}|${f.z.toFixed(1)}`)).size).toBeGreaterThan(2);
    expect(fired.every((f) => f.z > 0)).toBe(true);
  });

  it("will not fire inland: a battery's guns bear only to seaward", () => {
    const sim = new Simulation({ seed: 4, windDirection: 0, windSpeed: 3 });
    const fort = sim.spawnFort(site("battery", "crown"));
    sim.spawnShip({ classId: "brig", faction: "pirates", x: 0, z: -300, heading: Math.PI / 2 });
    expect(run(sim, 30).some((e) => e.type === "gunFired" && e.ship === fort.id)).toBe(false);
  });

  it("counts the mortars among the pieces to knock out, and remounts them when taken", () => {
    const sim = new Simulation({ seed: 4, windDirection: 0, windSpeed: 3 });
    const fort = sim.spawnFort(site("starFort", "pirates"));
    const f = fort.fort!;
    f.guns = f.guns.map(() => -1);
    const ship = sim.spawnShip({ classId: "liner", faction: "player", x: 0, z: 150, heading: 0 });
    const ev: DomainEvent[] = [];
    const rng = createRng(1);
    for (let k = 0; k < 400 && !f.silenced; k++) damageFort(sim.events, fort, ship.id, 20, 100, "round", vec3(0, 8, 40), rng);
    ev.push(...sim.drainEvents());
    expect(f.silenced).toBe(true);
    expect(f.hp).toBeGreaterThan(0);
    expect(ev.some((e) => e.type === "hit" && e.part === "wall")).toBe(true);
    f.garrison = 5;
    sim.command({ type: "assault", ship: ship.id, fort: fort.id });
    run(sim, 1, ev);
    expect(ev.some((e) => e.type === "fortCaptured")).toBe(true);
    expect(f.mortars.every((m) => m >= 0)).toBe(true);
  });

  it("gives the storming odds the assault rolls", () => {
    expect(stormChance(100, 100)).toBe(0);
    expect(stormChance(200, 100)).toBe(1);
    expect(stormChance(140 / 1.0, 100)).toBeCloseTo(0.5);
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
