import { describe, expect, it } from "vitest";
import { generateArchipelago, shipPrice, tradeInValue } from "@broadside/core";
import { Simulation } from "../src/simulation";
import { portOwner } from "../src/economy/trade";

const moored = () => {
  const map = generateArchipelago(5);
  const sim = new Simulation({ seed: 5, windDirection: 0, windSpeed: 0, archipelago: map });
  const index = sim.ports.findIndex((p, i) => portOwner(sim.world, i, p) !== "pirates");
  const site = sim.ports[index]!;
  const me = sim.spawnShip({ classId: "brig", faction: "player", x: site.x, z: site.z, heading: 0, player: true });
  return { sim, me, index };
};

describe("shipyard", () => {
  it("swaps the hull, keeps the id, crew and shot, and charges the difference", () => {
    const { sim, me, index } = moored();
    sim.purse.gold = 100000;
    const crew = me.ship!.crew;
    const round = me.ship!.stores.round;
    sim.command({ type: "trade", ship: me.id, port: index, service: "buyShip", qty: 1, classId: "frigate" });
    sim.step();
    expect(me.ship!.model.def.id).toBe("frigate");
    expect(sim.byId(me.id)).toBe(me);
    expect(me.ship!.crew).toBe(crew);
    expect(me.ship!.stores.round).toBe(round);
    expect(me.body!.mass).toBeCloseTo(me.ship!.model.mass);
    const paid = 100000 - sim.purse.gold;
    expect(paid).toBeGreaterThan(0);
    expect(paid).toBeLessThanOrEqual(shipPrice("frigate", 1) - tradeInValue("brig", 1) + 1);
  });

  it("refuses without the gold", () => {
    const { sim, me, index } = moored();
    sim.purse.gold = 10;
    sim.command({ type: "trade", ship: me.id, port: index, service: "buyShip", qty: 1, classId: "liner" });
    sim.step();
    expect(me.ship!.model.def.id).toBe("brig");
    expect(sim.drainEvents().some((e) => e.type === "tradeRefused" && e.reason === "gold")).toBe(true);
  });

  it("pays a battered ship less in part exchange", () => {
    expect(tradeInValue("brig", 0.5)).toBeLessThan(tradeInValue("brig", 1));
  });
});

describe("shipyard part exchange", () => {
  it("pays out when the new hull is cheaper than the old one", () => {
    const { sim, me, index } = moored();
    sim.purse.gold = 0;
    sim.command({ type: "trade", ship: me.id, port: index, service: "buyShip", qty: 1, classId: "cutter" });
    sim.step();
    expect(me.ship!.model.def.id).toBe("cutter");
    expect(sim.purse.gold).toBeGreaterThan(0);
  });
});

describe("refits", () => {
  const sail = (copper: boolean) => {
    const sim = new Simulation({ seed: 40, windDirection: Math.PI / 2, windSpeed: 9 });
    const me = sim.spawnShip({ classId: "brig", faction: "player", x: 0, z: 0, heading: 0, player: true, speed: 4 });
    if (copper) me.ship!.upgrades.push("copper");
    sim.command({ type: "course", ship: me.id, heading: 0 });
    for (let i = 0; i < 60 * 60; i++) sim.step();
    return Math.hypot(me.body!.vel.x, me.body!.vel.z);
  };

  it("copper sheathing makes the ship faster", () => {
    expect(sail(true)).toBeGreaterThan(sail(false) * 1.01);
  });

  it("is fitted at a yard and paid for, once", () => {
    const { sim, me, index } = moored();
    sim.purse.gold = 50000;
    sim.command({ type: "trade", ship: me.id, port: index, service: "upgrade", qty: 1, upgrade: "riders" });
    sim.step();
    const after = sim.purse.gold;
    expect(me.ship!.upgrades).toEqual(["riders"]);
    expect(after).toBeLessThan(50000);
    sim.command({ type: "trade", ship: me.id, port: index, service: "upgrade", qty: 1, upgrade: "riders" });
    sim.step();
    expect(sim.purse.gold).toBe(after);
  });
});
