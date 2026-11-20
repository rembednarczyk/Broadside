import { describe, expect, it } from "vitest";
import { type DomainEvent, contractOffer, generateArchipelago } from "@broadside/core";
import { Simulation } from "../src/simulation";
import { portOwner } from "../src/economy/trade";
import { restore, snapshot } from "../src/save/snapshot";

const map = generateArchipelago(5);
const moored = (pirateHaven = false) => {
  const sim = new Simulation({ seed: 5, windDirection: 0, windSpeed: 6, archipelago: map });
  const index = sim.ports.findIndex((p, i) => (portOwner(sim.world, i, p) === "pirates") === pirateHaven);
  const site = sim.ports[index]!;
  const me = sim.spawnShip({ classId: "frigate", faction: "player", x: site.ax, z: site.az, heading: 0, player: true });
  return { sim, me, index, owner: portOwner(sim.world, index, site) };
};
const take = (sim: Simulation, ship: number, port: number) => {
  sim.command({ type: "trade", ship, port, service: "contract", qty: 1 });
  sim.step();
  return sim.drainEvents();
};

describe("contracts", () => {
  it("offers the same job for the same seed, port and epoch", () => {
    expect(contractOffer(5, 2, 7, "crown", 6)).toEqual(contractOffer(5, 2, 7, "crown", 6));
    expect(contractOffer(5, 2, 7, "pirates", 6).kind).toBe("raid");
  });

  it("spawns the target, keeps it on the map and pays when it strikes", () => {
    const { sim, me, index } = moored();
    const ev = take(sim, me.id, index);
    const acc = ev.find((e) => e.type === "contractAccepted");
    expect(acc).toBeDefined();
    const target = sim.byId(sim.jobs.active!.target)!;
    expect(target).toBeDefined();
    const gold = sim.purse.gold;
    const reward = sim.jobs.active!.offer.reward;
    if (sim.jobs.active!.offer.kind === "escort") {
      const dest = sim.ports[sim.jobs.active!.offer.dest]!;
      target.body!.pos = { ...target.body!.pos, x: dest.x, z: dest.z };
    } else {
      // Struck to the player's guns.
      target.ship!.hitByPlayer = true;
      target.ship!.struck = true;
    }
    sim.step();
    const out: DomainEvent[] = sim.drainEvents();
    expect(out.some((e) => e.type === "contractDone")).toBe(true);
    expect(sim.purse.gold).toBe(gold + reward);
    expect(sim.jobs.active).toBeNull();
  });

  it("takes one contract at a time and fails it at the deadline", () => {
    const { sim, me, index } = moored(true);
    take(sim, me.id, index);
    const first = sim.jobs.active!.target;
    take(sim, me.id, index);
    expect(sim.jobs.active!.target).toBe(first);
    sim.env.time = sim.jobs.active!.deadline + 1;
    sim.step();
    expect(sim.drainEvents().some((e) => e.type === "contractFailed")).toBe(true);
  });

  it("is saved with the game", () => {
    const { sim, me, index } = moored();
    take(sim, me.id, index);
    const opts = { seed: 5, windDirection: 0, windSpeed: 6, archipelago: map };
    const back = restore(JSON.parse(JSON.stringify(snapshot(sim, opts))), map);
    expect(back.jobs.active).toEqual(sim.jobs.active);
  });

  it("shows the offer of a port", () => {
    const { sim, index } = moored();
    const o = sim.contractOffer(index)!;
    expect(o.reward).toBeGreaterThan(0);
    expect(sim.contractOffer(-1)).toBeNull();
  });

  it("pays a bounty only when the player's guns struck her", () => {
    for (let k = 0; k < 6; k++) {
      const { sim, me, index } = moored();
      sim.env.time += k * 3600;
      take(sim, me.id, index);
      if (sim.jobs.active?.offer.kind !== "bounty") continue;
      const target = sim.byId(sim.jobs.active.target)!;
      target.ship!.lastHitBy = 999;
      target.ship!.struck = true;
      const gold = sim.purse.gold;
      sim.step();
      expect(sim.drainEvents().some((e) => e.type === "contractFailed")).toBe(true);
      expect(sim.purse.gold).toBe(gold);
      return;
    }
  });
});
