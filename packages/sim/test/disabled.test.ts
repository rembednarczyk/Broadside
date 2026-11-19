import { describe, expect, it } from "vitest";
import { DISABLED } from "@broadside/core";
import { Simulation } from "../src/simulation";
import { board } from "../src/combat/boarding";
import { createRng } from "@broadside/core";

const run = (sim: Simulation, seconds: number) => {
  for (let i = 0; i < seconds * 60; i++) sim.step();
};

/** A pirate brig dismasted 150 m off a player's frigate (the frigate's people outnumber hers). */
const scene = (pirateCrew: number) => {
  const sim = new Simulation({ seed: 9, windDirection: 0, windSpeed: 7 });
  const me = sim.spawnShip({ classId: "frigate", faction: "player", x: 0, z: 0, heading: 0 });
  const pirate = sim.spawnShip({ classId: "brig", faction: "pirates", x: 150, z: 0, heading: 0, ai: true, role: "patrol" });
  pirate.ship!.mastHp = pirate.ship!.mastHp.map(() => 0);
  pirate.ship!.crew = pirateCrew;
  return { sim, me, pirate };
};

describe("a disabled ship (M11, Black Flag's disabled ship)", () => {
  it("strikes her colours when an enemy closes and her people are outnumbered", () => {
    const { sim, me, pirate } = scene(80);
    expect(pirate.ship!.crew * DISABLED.outnumbered).toBeLessThan(me.ship!.crew);
    run(sim, 3);
    expect(pirate.ship!.struck).toBe(true);
  });

  it("fights on, and does not try to run, while she has the men", () => {
    const { sim, me, pirate } = scene(250);
    me.ship!.crew = 200;
    run(sim, 3);
    expect(pirate.ship!.struck).toBe(false);
    expect(pirate.captain!.mode).not.toBe("flee");
  });

  it("defends her deck worse against boarders", () => {
    let wonFit = 0;
    let wonDisabled = 0;
    for (let seed = 1; seed <= 40; seed++) {
      for (const disabled of [false, true]) {
        const sim = new Simulation({ seed, windDirection: 0, windSpeed: 0 });
        const a = sim.spawnShip({ classId: "brig", faction: "player", x: 0, z: 0, heading: 0 });
        const d = sim.spawnShip({ classId: "brig", faction: "pirates", x: 12, z: 0, heading: 0 });
        a.ship!.crew = 120;
        d.ship!.crew = 100;
        if (disabled) d.ship!.mastHp = d.ship!.mastHp.map(() => 0);
        const events: { type: string; won?: boolean }[] = [];
        board({ push: (e: { type: string; won?: boolean }) => events.push(e) } as never, a, d, createRng(seed), null);
        const won = events.some((e) => e.type === "boarded" && e.won);
        if (disabled) wonDisabled += won ? 1 : 0;
        else wonFit += won ? 1 : 0;
      }
    }
    expect(wonDisabled).toBeGreaterThan(wonFit);
  });
});
