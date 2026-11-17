import { describe, expect, it } from "vitest";
import { DOCTRINES, wrapAngle, yawOf } from "@broadside/core";
import { Simulation } from "../src/simulation";
import { LINE_INTERVAL, aimHeightFor, lineStation, tacticalHeading } from "../src/ai/tactics";

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

  it("forms line of battle astern of a fighting leader, each ship on her next ahead", () => {
    const sim = new Simulation({ seed: 1, windDirection: 0, windSpeed: 8 });
    const lead = sim.spawnShip({ classId: "frigate", faction: "crown", x: 0, z: 0, heading: Math.PI / 2, ai: true, role: "patrol" });
    const second = sim.spawnShip({ classId: "frigate", faction: "crown", x: -300, z: 40, heading: Math.PI / 2, ai: true, role: "patrol" });
    const third = sim.spawnShip({ classId: "brig", faction: "crown", x: -500, z: -60, heading: 1, ai: true, role: "patrol" });
    second.captain!.leader = lead.id;
    third.captain!.leader = lead.id;
    const ships = [lead, second, third];
    // A leader on patrol keeps no line: the convoy station applies.
    expect(lineStation(second, ships)).toBeNull();
    lead.captain!.mode = "engage";
    const s2 = lineStation(second, ships)!;
    expect(s2.ahead.id).toBe(lead.id);
    // 300 m astern and 40 m to port of the wake: all sail, and a course to starboard of the line's.
    expect(s2.astern).toBeCloseTo(300, 3);
    expect(s2.level).toBe(3);
    expect(s2.course).toBeGreaterThan(Math.PI / 2 + 0.1);
    expect(s2.course).toBeLessThan(Math.PI / 2 + 0.5);
    // The third ship follows the second, not the leader: astern of her along her own heading.
    const s3 = lineStation(third, ships)!;
    expect(s3.ahead.id).toBe(second.id);
    expect(s3.astern).toBeCloseTo(200, 3);
    // Drawn too close to her next ahead, a ship shortens sail.
    third.body!.pos = { ...third.body!.pos, x: -300 - LINE_INTERVAL + 60 };
    expect(lineStation(third, ships)!.level).toBe(1);
    // When the second strikes, the third closes up on the leader.
    second.ship!.struck = true;
    expect(lineStation(third, ships)!.ahead.id).toBe(lead.id);
    // The leader herself, and a merchant in convoy, keep no station in the line.
    expect(lineStation(lead, ships)).toBeNull();
    third.captain!.role = "trade";
    expect(lineStation(third, ships)).toBeNull();
  });

  it("keeps the line in a running fight: followers astern of the leader, in order", () => {
    const sim = new Simulation({ seed: 5, windDirection: Math.PI / 2, windSpeed: 9 });
    const lead = sim.spawnShip({ classId: "frigate", faction: "crown", x: 0, z: 0, heading: 0, speed: 3, ai: true, role: "patrol" });
    const a = sim.spawnShip({ classId: "frigate", faction: "crown", x: 60, z: -150, heading: 0, speed: 3, ai: true, role: "patrol" });
    const b = sim.spawnShip({ classId: "brig", faction: "crown", x: -60, z: -300, heading: 0, speed: 3, ai: true, role: "patrol" });
    a.captain!.leader = lead.id;
    b.captain!.leader = lead.id;
    sim.spawnShip({ classId: "liner", faction: "republic", x: 250, z: 700, heading: Math.PI, speed: 3, ai: true, role: "patrol" });
    let inLine = 0;
    let samples = 0;
    for (let i = 0; i < 60 * 150; i++) {
      sim.step();
      if (i < 60 * 40 || i % 60 !== 0 || lead.captain!.mode !== "engage" || a.ship!.sinking || b.ship!.sinking) continue;
      samples++;
      // In the wake: within 35 degrees of dead astern of the next ahead, 50 to 260 m off.
      const astern = (f: typeof lead, ahead: typeof lead): boolean => {
        const dx = f.body!.pos.x - ahead.body!.pos.x;
        const dz = f.body!.pos.z - ahead.body!.pos.z;
        const gap = Math.hypot(dx, dz);
        return gap > 50 && gap < 260 && Math.abs(wrapAngle(Math.atan2(dx, dz) - yawOf(ahead.body!.rot) - Math.PI)) < 0.6;
      };
      if (astern(a, lead) && astern(b, a)) inLine++;
    }
    expect(samples).toBeGreaterThan(30);
    // Measured 0.59 with the line, 0.19 without it (every ship fighting on her own).
    expect(inLine / samples).toBeGreaterThan(0.45);
  });
});
