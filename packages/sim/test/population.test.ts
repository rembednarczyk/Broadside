import { describe, expect, it } from "vitest";
import { generateArchipelago, pickTraffic } from "@broadside/core";
import { Simulation } from "../src/simulation";
import { DIRECTOR } from "../src/world/director";
import { stateHash } from "../src/hash";

const run = (sim: Simulation, seconds: number) => {
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    sim.step();
    sim.drainEvents();
  }
};

const sandbox = (seed: number) => {
  const sim = new Simulation({ seed, windDirection: 1, windSpeed: 7, traffic: true });
  sim.spawnShip({ classId: "brig", faction: "player", x: 0, z: 0, heading: 0, player: true });
  return sim;
};

const ai = (sim: Simulation) => sim.ships().filter((s) => s.captain);

describe("population director", () => {
  it("fills the sea around the player up to the budget, out of sight", () => {
    const sim = sandbox(3);
    run(sim, DIRECTOR.period * (DIRECTOR.budget + 1) + 1);
    const ships = ai(sim);
    expect(ships.length).toBe(DIRECTOR.budget);
    for (const s of ships) expect(Math.hypot(s.body!.pos.x, s.body!.pos.z)).toBeLessThan(DIRECTOR.keep);
  });

  it("stays off by default (tests and set pieces)", () => {
    const sim = new Simulation({ seed: 3, windDirection: 1, windSpeed: 7 });
    sim.spawnShip({ classId: "brig", faction: "player", x: 0, z: 0, heading: 0, player: true });
    run(sim, DIRECTOR.period * 3);
    expect(ai(sim)).toHaveLength(0);
  });

  it("takes far ships off the map", () => {
    const sim = sandbox(4);
    const far = sim.spawnShip({ classId: "sloop", faction: "crown", x: DIRECTOR.keep + 800, z: 0, heading: 0, ai: true });
    run(sim, DIRECTOR.period + 0.1);
    expect(sim.byId(far.id)).toBeUndefined();
  });

  it("sends only peaceful traffic while the player is fighting (relax phase)", () => {
    const sim = sandbox(5);
    const pirate = sim.spawnShip({ classId: "schooner", faction: "pirates", x: 500, z: 0, heading: 0, ai: true });
    run(sim, DIRECTOR.period * 4 + 0.1);
    const fresh = ai(sim).filter((s) => s.id !== pirate.id && !pirate.ship!.struck);
    expect(fresh.length).toBeGreaterThan(0);
    for (const s of fresh) expect(s.captain!.role).toBe("trade");
  });

  it("is deterministic", () => {
    const a = sandbox(6);
    const b = sandbox(6);
    run(a, 40);
    run(b, 40);
    expect(stateHash(a)).toBe(stateHash(b));
  });

  it("picks traffic by weight", () => {
    expect(pickTraffic(0).id).toBe("merchant");
    expect(pickTraffic(0.999).id).toBe("hunter");
  });
});

describe("standing orders", () => {
  it("merchants sail for a port", () => {
    const map = generateArchipelago(11);
    const sim = new Simulation({ seed: 11, windDirection: 1, windSpeed: 7, archipelago: map });
    const m = sim.spawnShip({ classId: "brig", faction: "crown", x: 0, z: 0, heading: 0, ai: true, role: "trade" });
    run(sim, 1);
    const c = m.captain!;
    expect(c.dest).toBeGreaterThanOrEqual(0);
    expect(c.wx).toBe(sim.ports[c.dest]!.x);
  });

  it("merchants run from pirates instead of fighting", () => {
    const sim = new Simulation({ seed: 12, windDirection: 1, windSpeed: 7 });
    const m = sim.spawnShip({ classId: "brig", faction: "crown", x: 0, z: 0, heading: 0, ai: true, role: "trade" });
    sim.spawnShip({ classId: "sloop", faction: "pirates", x: 300, z: 0, heading: 0 });
    run(sim, 1);
    expect(m.captain!.mode).toBe("flee");
  });

  it("hunters go after the player from beyond lookout range", () => {
    const sim = new Simulation({ seed: 13, windDirection: 1, windSpeed: 7 });
    const p = sim.spawnShip({ classId: "brig", faction: "player", x: 0, z: 0, heading: 0, player: true });
    const h = sim.spawnShip({ classId: "schooner", faction: "pirates", x: 2000, z: 0, heading: 0, ai: true, role: "hunt" });
    run(sim, 1);
    expect(h.captain!.target).toBe(p.id);
  });
});

describe("smoke screen", () => {
  it("hides the player from a lookout until it thins away", async () => {
    const { SMOKE } = await import("../src/combat/smoke");
    const sim = new Simulation({ seed: 30, windDirection: 0, windSpeed: 0.1 });
    const me = sim.spawnShip({ classId: "brig", faction: "player", x: 0, z: 0, heading: 0, player: true });
    const p = sim.spawnShip({ classId: "sloop", faction: "pirates", x: 400, z: 0, heading: Math.PI, ai: true });
    sim.world.add({ id: 0, smoke: { x: 200, z: 0, age: SMOKE.grow } });
    run(sim, 1);
    expect(p.captain!.target).toBeNull();
    run(sim, SMOKE.life);
    expect(p.captain!.target).toBe(me.id);
  });

  it("is laid from the stores over the stern", () => {
    const sim = new Simulation({ seed: 31, windDirection: 0, windSpeed: 5 });
    const me = sim.spawnShip({ classId: "brig", faction: "player", x: 0, z: 0, heading: 0, player: true });
    const before = me.ship!.stores.smoke!;
    sim.command({ type: "drop", ship: me.id, ammo: "smoke" });
    run(sim, 0.1);
    expect(me.ship!.stores.smoke).toBe(before - 1);
    expect([...sim.world.with("smoke")]).toHaveLength(1);
  });
});
