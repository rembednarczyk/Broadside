import { describe, expect, it } from "vitest";
import { wrapAngle, yawOf } from "@broadside/core";
import { Simulation } from "../src/simulation";
import { arriveDistance } from "../src/ai/pilot/seamanship";
import { restore, snapshot } from "../src/save/snapshot";

const WIND = 1.2;
/** Sails until `done` or `seconds` pass; returns the seconds taken (Infinity: not done). */
const sail = (sim: Simulation, seconds: number, done: () => boolean): number => {
  for (let i = 0; i < seconds * 60; i++) {
    sim.step();
    if (done()) return i / 60;
  }
  return Infinity;
};

describe("simple steering: the crew sails the player's route", () => {
  it("makes sail, sails a square rigger to a point off the wind and takes in sail there", () => {
    const sim = new Simulation({ seed: 7, windDirection: WIND, windSpeed: 8 });
    const me = sim.spawnShip({ classId: "galleon", faction: "player", x: 0, z: 0, heading: 0, player: true });
    me.ship!.sailTarget = me.ship!.sailTarget.map(() => 0);
    // A point across and down the wind, 450 m off.
    const to = { x: Math.sin(WIND + 0.9) * 450, z: Math.cos(WIND + 0.9) * 450 };
    sim.command({ type: "navigate", ship: me.id, route: [to], hold: false });
    sim.step();
    expect(me.ship!.sailTarget.every((l) => l > 0)).toBe(true);
    const t = sail(sim, 240, () => !me.pilot);
    expect(t).toBeLessThan(240);
    expect(Math.hypot(me.body!.pos.x - to.x, me.body!.pos.z - to.z)).toBeLessThan(arriveDistance(me.ship!.model.def.hull.length) + 5);
    // Arrived: sail taken in.
    expect(me.ship!.sailTarget.every((l) => l === 0)).toBe(true);
  });

  it("beats up to a point dead to windward, tacking on the layline", () => {
    const sim = new Simulation({ seed: 7, windDirection: WIND, windSpeed: 8 });
    const me = sim.spawnShip({ classId: "sloop", faction: "player", x: 0, z: 0, heading: WIND + Math.PI / 2, player: true });
    // A square rig's track lies some 80 deg off the wind: 200 m to windward is well over a
    // kilometre of beating.
    const to = { x: -Math.sin(WIND) * 200, z: -Math.cos(WIND) * 200 };
    sim.command({ type: "navigate", ship: me.id, route: [to], hold: false });
    expect(sail(sim, 700, () => !me.pilot)).toBeLessThan(700);
    expect(Math.hypot(me.body!.pos.x - to.x, me.body!.pos.z - to.z)).toBeLessThan(arriveDistance(me.ship!.model.def.hull.length) + 5);
  });

  it("follows a drawn course through its points and holds the last leg's direction", () => {
    const sim = new Simulation({ seed: 7, windDirection: WIND, windSpeed: 8 });
    const me = sim.spawnShip({ classId: "sloop", faction: "player", x: 0, z: 0, heading: WIND + 1.4, player: true });
    const route = [{ x: Math.sin(WIND + 1.4) * 150, z: Math.cos(WIND + 1.4) * 150 }];
    route.push({ x: route[0]!.x + Math.sin(WIND + 0.6) * 150, z: route[0]!.z + Math.cos(WIND + 0.6) * 150 });
    sim.command({ type: "navigate", ship: me.id, route, hold: true });
    expect(sail(sim, 300, () => !me.pilot)).toBeLessThan(300);
    // Still under sail, steering the direction of the last leg.
    expect(me.ship!.sailTarget.some((l) => l > 0)).toBe(true);
    expect(Math.abs(wrapAngle(me.ship!.course! - (WIND + 0.6)))).toBeLessThan(0.15);
    sail(sim, 20, () => false);
    expect(Math.abs(wrapAngle(yawOf(me.body!.rot) - (WIND + 0.6)))).toBeLessThan(0.3);
  });

  it("gives the wheel back when the player steers, and survives a save", () => {
    const sim = new Simulation({ seed: 7, windDirection: WIND, windSpeed: 8 });
    const me = sim.spawnShip({ classId: "sloop", faction: "player", x: 0, z: 0, heading: 0, player: true });
    sim.command({ type: "navigate", ship: me.id, route: [{ x: 0, z: 800 }], hold: false });
    sim.step();
    expect(me.pilot).toBeDefined();
    const copy = restore(JSON.parse(JSON.stringify(snapshot(sim, { seed: 7, windDirection: WIND, windSpeed: 8 }))), null);
    expect(copy.player()?.pilot?.order).toMatchObject({ kind: "route", route: [{ x: 0, z: 800 }] });
    sim.command({ type: "helm", ship: me.id, rudder: 0.3 });
    sim.step();
    expect(me.pilot).toBeUndefined();
    sim.command({ type: "navigate", ship: me.id, route: [{ x: 0, z: 800 }], hold: false });
    sim.step();
    sim.command({ type: "navigate", ship: me.id, route: [], hold: false });
    sim.step();
    expect(me.pilot).toBeUndefined();
  });
});

describe("simple steering: orders about ships and forts", () => {
  it("runs down a slower ship, comes alongside at her speed and boards her", () => {
    const sim = new Simulation({ seed: 7, windDirection: WIND, windSpeed: 8 });
    const me = sim.spawnShip({ classId: "frigate", faction: "player", x: 0, z: 0, heading: WIND, player: true });
    const prey = sim.spawnShip({ classId: "sloop", faction: "pirates", x: Math.sin(WIND + 0.5) * 300, z: Math.cos(WIND + 0.5) * 300, heading: WIND + 0.5 });
    prey.ship!.sailTarget = prey.ship!.sailTarget.map(() => 1);
    sim.command({ type: "pilot", ship: me.id, order: { kind: "board", target: prey.id } });
    const events: string[] = [];
    const t = sail(sim, 300, () => {
      for (const e of sim.drainEvents()) events.push(e.type);
      return !me.pilot;
    });
    expect(t).toBeLessThan(300);
    expect(events.some((e) => /board/i.test(e))).toBe(true);
  });

  it("keeps station astern of a friendly ship", () => {
    const sim = new Simulation({ seed: 7, windDirection: WIND, windSpeed: 8 });
    const me = sim.spawnShip({ classId: "sloop", faction: "player", x: 0, z: 0, heading: WIND, player: true });
    const lead = sim.spawnShip({ classId: "brig", faction: "player", x: Math.sin(WIND) * 250, z: Math.cos(WIND) * 250, heading: WIND });
    // A merchant under easy sail, as a convoy goes.
    lead.ship!.sailTarget = lead.ship!.sailTarget.map(() => 1);
    sim.command({ type: "pilot", ship: me.id, order: { kind: "follow", target: lead.id } });
    sail(sim, 200, () => false);
    expect(me.pilot).toBeDefined();
    const d = Math.hypot(me.body!.pos.x - lead.body!.pos.x, me.body!.pos.z - lead.body!.pos.z);
    expect(d).toBeLessThan(260);
  });

  it("gives the same voyage for the same orders (no random source)", () => {
    const run = (): string => {
      const sim = new Simulation({ seed: 3, windDirection: WIND, windSpeed: 8 });
      const me = sim.spawnShip({ classId: "brig", faction: "player", x: 0, z: 0, heading: 0, player: true });
      const other = sim.spawnShip({ classId: "sloop", faction: "pirates", x: 200, z: 300, heading: 1 });
      sim.command({ type: "pilot", ship: me.id, order: { kind: "board", target: other.id } });
      sail(sim, 60, () => false);
      return `${me.body!.pos.x.toFixed(6)},${me.body!.pos.z.toFixed(6)}`;
    };
    expect(run()).toBe(run());
  });
});
