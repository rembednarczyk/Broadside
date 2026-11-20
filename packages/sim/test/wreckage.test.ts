import { describe, expect, it } from "vitest";
import { WRECKAGE, rotateInv, wrapAngle, yawOf } from "@broadside/core";
import { Simulation } from "../src/simulation";

const run = (sim: Simulation, seconds: number) => {
  for (let i = 0; i < seconds * 60; i++) sim.step();
};

/** A brig on a beam reach (wind from port), her foremast shot away after 60 s. */
const voyage = (dismast: boolean) => {
  const sim = new Simulation({ seed: 12, windDirection: Math.PI / 2, windSpeed: 9 });
  const e = sim.spawnShip({ classId: "brig", faction: "player", x: 0, z: 0, heading: 0 });
  sim.command({ type: "helm", ship: e.id, rudder: 0 });
  run(sim, 60);
  const before = rotateInv(e.body!.rot, e.body!.vel).z;
  const yaw0 = yawOf(e.body!.rot);
  if (dismast) e.ship!.mastHp[0] = 0;
  run(sim, 15);
  return { sim, e, before, after: rotateInv(e.body!.rot, e.body!.vel).z, turned: wrapAngle(yawOf(e.body!.rot) - yaw0) };
};

describe("wreckage alongside", () => {
  it("a mast gone by the board drags to leeward, slows the ship and turns her towards it", () => {
    const clean = voyage(false);
    const wrecked = voyage(true);
    const w = wrecked.e.ship!.wrecks[0]!;
    expect(w.mast).toBe(0);
    expect(w.side).toBe(1);
    expect(w.left).toBeGreaterThan(0);
    expect(wrecked.after).toBeLessThan(clean.after * 0.75);
    // Towards the wreck (starboard, to leeward): the heading swings to starboard more than without it.
    expect(wrecked.turned).toBeGreaterThan(clean.turned + 0.1);
  });

  it("is cut away in time and stops dragging", () => {
    const { sim, e } = voyage(true);
    run(sim, WRECKAGE.cut * 2);
    expect(e.ship!.wrecks[0]!.left).toBe(0);
  });
});
