import { describe, expect, it } from "vitest";
import { DOCTRINES, wrapAngle } from "@broadside/core";
import { Simulation } from "../src/simulation";
import { aimHeightFor, tacticalHeading } from "../src/ai/tactics";

const pair = (mx: number, mz: number, targetHeading: number) => {
  const sim = new Simulation({ seed: 1, windDirection: 0, windSpeed: 8 });
  const me = sim.spawnShip({ classId: "frigate", faction: "crown", x: mx, z: mz, heading: 0 });
  const t = sim.spawnShip({ classId: "frigate", faction: "republic", x: 0, z: 0, heading: targetHeading });
  return { me, t };
};

describe("tactics of the age of sail", () => {
  it("works to windward of the enemy before closing (weather gauge)", () => {
    // Wind blows towards +Z: a ship at z = +800 is to leeward of a target at the origin.
    const { me, t } = pair(0, 800, 0);
    const h = tacticalHeading(me, t, DOCTRINES.crown, 0, 800, 300, false)!;
    // Steer for a point upwind (z < 0) of the target: roughly towards -Z.
    expect(Math.abs(wrapAngle(h - Math.PI))).toBeLessThan(0.4);
    expect(tacticalHeading(me, t, DOCTRINES.republic, 0, 800, 300, false)).toBeNull();
  });

  it("does not seek the gauge from windward", () => {
    const { me, t } = pair(0, -800, 0);
    expect(tacticalHeading(me, t, DOCTRINES.crown, 0, 800, 300, false)).toBeNull();
  });

  it("works round to the enemy's quarter to rake him, or keeps a raking course already there", () => {
    // Target heading +X; we lie on his beam (+Z side), reloading: head for his quarter (x < 0).
    const beam = pair(0, 200, Math.PI / 2);
    const h = tacticalHeading(beam.me, beam.t, DOCTRINES.crown, Math.PI, 200, 300, false)!;
    expect(Math.sin(h)).toBeLessThan(0);
    // Already astern of him: the basic broadside course rakes.
    const astern = pair(-200, 0, Math.PI / 2);
    expect(tacticalHeading(astern.me, astern.t, DOCTRINES.crown, Math.PI, 200, 300, false)).toBeNull();
  });

  it("lays the guns high for the French school, low for the British", () => {
    const { t } = pair(0, 200, 0);
    expect(aimHeightFor(DOCTRINES.republic, t)).toBeGreaterThan(8);
    expect(aimHeightFor(DOCTRINES.crown, t)).toBeLessThan(1);
  });
});
