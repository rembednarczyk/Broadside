import { describe, expect, it } from "vitest";
import { wrapAngle, yawOf } from "@broadside/core";
import { Simulation } from "../src/simulation";
import { arriveDistance } from "../src/ai/pilot";
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
    expect(copy.player()?.pilot?.route).toEqual([{ x: 0, z: 800 }]);
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
