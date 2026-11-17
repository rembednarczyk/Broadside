import { describe, expect, it } from "vitest";
import { generateArchipelago } from "@broadside/core";
import { Simulation } from "../src/simulation";

describe("captain's rescue", () => {
  it("puts the captain ashore at a friendly port in a sloop when his ship goes down", () => {
    const map = generateArchipelago(5);
    const sim = new Simulation({ seed: 5, windDirection: 0, windSpeed: 6, archipelago: map });
    const me = sim.spawnShip({ classId: "brig", faction: "player", x: 0, z: 0, heading: 0, player: true });
    sim.purse.gold = 777;
    sim.purse.plunder = 50;
    me.ship!.sinking = true;
    const events = [];
    for (let i = 0; i < 60 * 60; i++) {
      sim.step();
      events.push(...sim.drainEvents());
    }
    expect(sim.byId(me.id)).toBe(me);
    expect(me.ship!.model.def.id).toBe("sloop");
    expect(me.ship!.sinking).toBe(false);
    expect(sim.purse.gold).toBe(777);
    expect(sim.purse.plunder).toBe(0);
    const ev = events.find((e) => e.type === "playerRescued");
    expect(ev).toBeDefined();
    if (ev?.type === "playerRescued" && ev.port >= 0) {
      const p = sim.ports[ev.port]!;
      expect(Math.hypot(me.body!.pos.x - p.x, me.body!.pos.z - p.z)).toBeLessThan(800);
    }
  });

  it("takes the captain off a ship with no one left aboard", () => {
    const sim = new Simulation({ seed: 6, windDirection: 0, windSpeed: 6 });
    const me = sim.spawnShip({ classId: "brig", faction: "player", x: 0, z: 0, heading: 0, player: true });
    me.ship!.crew = 0;
    sim.step();
    expect(me.ship!.model.def.id).toBe("sloop");
    expect(me.ship!.crew).toBeGreaterThan(0);
  });
});
