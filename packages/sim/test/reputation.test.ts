import { describe, expect, it } from "vitest";
import { type DomainEvent, REPUTATION, applyDeed, createRelations, isHostile, priceFactor, standing } from "@broadside/core";
import { Simulation } from "../src/simulation";
import { restore, snapshot } from "../src/save/snapshot";

const hit = (ship: number, by: number): DomainEvent => ({ type: "hit", ship, by, at: { x: 0, y: 0, z: 0 }, part: "hull", damage: 1 });

const setup = () => {
  const sim = new Simulation({ seed: 21, windDirection: 0, windSpeed: 5 });
  const me = sim.spawnShip({ classId: "brig", faction: "player", x: 0, z: 0, heading: 0, player: true });
  const crown = sim.spawnShip({ classId: "sloop", faction: "crown", x: 300, z: 0, heading: 0, ai: true });
  return { sim, me, crown };
};

describe("reputation", () => {
  it("forgives a stray ball, not a sustained attack", () => {
    const { sim, me, crown } = setup();
    sim.events.push(hit(crown.id, me.id));
    expect(isHostile(sim.relations.crown)).toBe(false);
    for (let i = 0; i < 30; i++) sim.events.push(hit(crown.id, me.id));
    expect(isHostile(sim.relations.crown)).toBe(true);
    const ev = sim.drainEvents();
    expect(ev.filter((e) => e.type === "standingChanged")).toEqual([{ type: "standingChanged", faction: "crown", hostile: true }]);
  });

  it("makes the nation's ships, forts and ports treat the player as an enemy", () => {
    const { sim, me, crown } = setup();
    sim.events.push({ type: "shipSunk", ship: crown.id, by: me.id });
    sim.events.push({ type: "shipSunk", ship: crown.id, by: me.id });
    expect(isHostile(standing("crown", "player", sim.relations))).toBe(true);
    expect(priceFactor("crown", "player", sim.relations)).toBeNull();
    for (let i = 0; i < 60; i++) sim.step();
    expect(crown.captain!.target).toBe(me.id);
  });

  it("is grateful for pirates sunk and pleases a nation's enemies", () => {
    const rel = createRelations();
    applyDeed(rel, "pirates", REPUTATION.sink);
    expect(rel.crown).toBeCloseTo(REPUTATION.pirate);
    applyDeed(rel, "republic", REPUTATION.sink);
    expect(rel.republic).toBeLessThan(0);
    expect(rel.crown).toBeCloseTo(REPUTATION.pirate + REPUTATION.enemyOfEnemy);
    expect(rel.empire).toBeCloseTo(REPUTATION.pirate);
  });

  it("ignores what others do", () => {
    const { sim, crown } = setup();
    const pirate = sim.spawnShip({ classId: "sloop", faction: "pirates", x: 0, z: 300, heading: 0 });
    sim.events.push({ type: "shipSunk", ship: crown.id, by: pirate.id });
    expect(sim.relations.crown).toBe(0);
  });

  it("is saved with the game", () => {
    const { sim, me, crown } = setup();
    sim.events.push({ type: "shipSunk", ship: crown.id, by: me.id });
    const opts = { seed: 21, windDirection: 0, windSpeed: 5 };
    const back = restore(JSON.parse(JSON.stringify(snapshot(sim, opts))), null);
    expect(back.relations.crown).toBeCloseTo(REPUTATION.sink);
  });
});
