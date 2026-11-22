import { describe, expect, it } from "vitest";
import { SHIP_CLASS_IDS, rollOf, rotateInv, yawOf, pitchOf } from "@broadside/core";
import { Simulation } from "../src/simulation";

const run = (sim: Simulation, seconds: number) => {
  for (let i = 0; i < seconds * 60; i++) sim.step();
};

const speedAhead = (sim: Simulation, id: number) => {
  const b = sim.byId(id)!.body!;
  return rotateInv(b.rot, b.vel).z;
};

describe("floating", () => {
  it("settles near the design waterline in a calm with sails furled", () => {
    const sim = new Simulation({ seed: 1, windDirection: 0, windSpeed: 0 });
    const e = sim.spawnShip({ classId: "sloop", faction: "player", x: 0, z: 0, heading: 0 });
    sim.command({ type: "sails", ship: e.id, mast: "all", level: 0 });
    run(sim, 20);
    // Over the next 10 s she rides the swell (a calm still has it) about the design waterline: no
    // drift up or down, a heave of a few centimetres. An instant's vertical speed was the check once,
    // and it depended on the swell's phase (it failed when the trim was corrected, 22.11).
    const b = e.body!;
    let sumVy = 0;
    let maxDy = 0;
    for (let i = 0; i < 600; i++) {
      sim.step();
      sumVy += b.vel.y;
      maxDy = Math.max(maxDy, Math.abs(b.pos.y - e.ship!.model.com.y));
    }
    expect(maxDy).toBeLessThan(0.35);
    expect(Math.abs(sumVy / 600)).toBeLessThan(0.05);
    expect(Math.abs(rollOf(b.rot))).toBeLessThan(0.05);
  });

  it("keeps every class upright under full sail in a fresh breeze", () => {
    for (const id of SHIP_CLASS_IDS) {
      const sim = new Simulation({ seed: 3, windDirection: Math.PI / 2, windSpeed: 9 });
      const e = sim.spawnShip({ classId: id, faction: "player", x: 0, z: 0, heading: 0 });
      let maxHeel = 0;
      for (let i = 0; i < 60 * 40; i++) {
        sim.step();
        maxHeel = Math.max(maxHeel, Math.abs(rollOf(e.body!.rot)));
      }
      expect(maxHeel, id).toBeLessThan(0.6);
      expect(Math.abs(pitchOf(e.body!.rot)), id).toBeLessThan(0.3);
      expect(Number.isFinite(e.body!.pos.x), id).toBe(true);
    }
  });
});

describe("sailing", () => {
  it("makes way on a beam reach at a plausible speed", () => {
    // Wind blows towards +X (from port); the ship heads +Z.
    const sim = new Simulation({ seed: 2, windDirection: Math.PI / 2, windSpeed: 8 });
    const e = sim.spawnShip({ classId: "sloop", faction: "player", x: 0, z: 0, heading: 0 });
    run(sim, 90);
    const v = speedAhead(sim, e.id);
    expect(v).toBeGreaterThan(2);
    expect(v).toBeLessThan(8);
  });

  it("goes faster with more sail and stops with none", () => {
    const speedWith = (level: 0 | 1 | 3) => {
      const sim = new Simulation({ seed: 2, windDirection: Math.PI / 2, windSpeed: 8 });
      const e = sim.spawnShip({ classId: "brig", faction: "player", x: 0, z: 0, heading: 0 });
      sim.command({ type: "sails", ship: e.id, mast: "all", level });
      run(sim, 90);
      return speedAhead(sim, e.id);
    };
    const none = speedWith(0);
    const reefed = speedWith(1);
    const full = speedWith(3);
    expect(Math.abs(none)).toBeLessThan(0.6);
    expect(full).toBeGreaterThan(reefed);
  });

  it("cannot sail straight into the wind", () => {
    const sim = new Simulation({ seed: 2, windDirection: Math.PI, windSpeed: 8 });
    const e = sim.spawnShip({ classId: "brig", faction: "player", x: 0, z: 0, heading: 0 });
    run(sim, 60);
    expect(speedAhead(sim, e.id)).toBeLessThan(0.5);
  });

  it("turns to starboard with starboard helm", () => {
    const sim = new Simulation({ seed: 2, windDirection: Math.PI / 2, windSpeed: 8 });
    const e = sim.spawnShip({ classId: "sloop", faction: "player", x: 0, z: 0, heading: 0, speed: 4 });
    run(sim, 10);
    const before = yawOf(e.body!.rot);
    sim.command({ type: "helm", ship: e.id, rudder: 1 });
    run(sim, 15);
    expect(yawOf(e.body!.rot) - before).toBeGreaterThan(0.3);
  });

  it("rows a gunboat in a calm", () => {
    const sim = new Simulation({ seed: 2, windDirection: 0, windSpeed: 0 });
    const e = sim.spawnShip({ classId: "gunboat", faction: "player", x: 0, z: 0, heading: 0 });
    sim.command({ type: "oars", ship: e.id, on: true });
    run(sim, 40);
    expect(speedAhead(sim, e.id)).toBeGreaterThan(1.5);
  });
});

describe("helmsman", () => {
  it("holds a course on a reach against weather helm", () => {
    const sim = new Simulation({ seed: 2, windDirection: Math.PI - 0.8, windSpeed: 9 });
    const e = sim.spawnShip({ classId: "cutter", faction: "player", x: 0, z: 0, heading: 0 });
    sim.command({ type: "course", ship: e.id, heading: 0 });
    run(sim, 60);
    expect(Math.abs(yawOf(e.body!.rot))).toBeLessThan(0.12);
  });

  it("comes about to a new course", () => {
    const sim = new Simulation({ seed: 2, windDirection: Math.PI / 2, windSpeed: 9 });
    const e = sim.spawnShip({ classId: "sloop", faction: "player", x: 0, z: 0, heading: 0, speed: 4 });
    sim.command({ type: "course", ship: e.id, heading: 1.2 });
    run(sim, 40);
    expect(Math.abs(yawOf(e.body!.rot) - 1.2)).toBeLessThan(0.12);
  });
});

describe("bracing the yards", () => {
  // Wind from the starboard beam, then the ship put about onto the other tack in a moment:
  // the yards swing round at the rate the hands can brace them, not at once.
  const swing = (crewShare: number): number[] => {
    const sim = new Simulation({ seed: 4, windDirection: Math.PI / 2, windSpeed: 9 });
    const e = sim.spawnShip({ classId: "frigate", faction: "player", x: 0, z: 0, heading: Math.PI * 0.15 });
    e.ship!.crew = Math.round(e.ship!.model.def.crew * crewShare);
    run(sim, 20);
    const before = e.ship!.sailChord[1]![0]!;
    // Turn the hull to the other side of the wind in one step (as a hard tack ends).
    const yaw = yawOf(e.body!.rot);
    const q = e.body!.rot;
    const half = -yaw * 0.85;
    const c = Math.cos(half);
    const s = Math.sin(half);
    e.body!.rot = { x: q.x * c + q.z * s, y: q.y * c + q.w * s, z: q.z * c - q.x * s, w: q.w * c - q.y * s };
    const chords = [before];
    for (let t = 0; t < 4; t++) {
      run(sim, 1);
      chords.push(e.ship!.sailChord[1]![0]!);
    }
    return chords;
  };

  it("swings the yards round over seconds, slower with fewer hands", () => {
    const full = swing(1);
    const short = swing(0.3);
    const step = (c: number[]): number => Math.abs(c[1]! - c[0]!);
    // A second of bracing moves the main course's yard a few degrees, never the whole range at once.
    expect(step(full)).toBeGreaterThan(0.02);
    expect(step(full)).toBeLessThan(0.15);
    expect(step(short)).toBeLessThan(step(full));
  });
});
