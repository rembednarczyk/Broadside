import { describe, expect, it } from "vitest";
import { Simulation } from "@broadside/sim";
import { aimOf } from "../src/aiming";

describe("the player's gunners lay for the shot they load", () => {
  const scene = () => {
    const sim = new Simulation({ seed: 3, windDirection: 0, windSpeed: 6 });
    const me = sim.spawnShip({ classId: "frigate", faction: "player", x: 0, z: 0, heading: 0 });
    const t = sim.spawnShip({ classId: "brig", faction: "pirates", x: 180, z: 0, heading: 0 });
    return { sim, me, t };
  };

  it("round shot at the waterline, chain at the masts, grape at the deck", () => {
    const { sim, me, t } = scene();
    me.ship!.ammoLoad.broadside = "round";
    expect(aimOf(sim, me, "broadside", "starboard").aimHeight).toBe(0);
    me.ship!.ammoLoad.broadside = "chain";
    const chain = aimOf(sim, me, "broadside", "starboard").aimHeight;
    expect(chain).toBeCloseTo(t.ship!.model.def.masts[0]!.height * 0.4);
    me.ship!.ammoLoad.broadside = "grape";
    const grape = aimOf(sim, me, "broadside", "starboard").aimHeight;
    expect(grape).toBeGreaterThan(0);
    expect(grape).toBeLessThan(chain);
  });
});

describe("chain shot laid at the masts", () => {
  it("cuts up the rigging and canvas far more than laid at the waterline", () => {
    const shoot = (aimHigh: boolean) => {
      const sim = new Simulation({ seed: 5, windDirection: 0, windSpeed: 0 });
      const me = sim.spawnShip({ classId: "frigate", faction: "player", x: 0, z: 0, heading: 0 });
      const t = sim.spawnShip({ classId: "brig", faction: "pirates", x: 120, z: 0, heading: 0 });
      for (const s of [me, t]) sim.command({ type: "sails", ship: s.id, mast: "all", level: 0 });
      me.ship!.ammoLoad.broadside = "chain";
      for (let volley = 0; volley < 3; volley++) {
        const a = aimOf(sim, me, "broadside", "starboard");
        sim.command({ type: "fire", ship: me.id, mount: "broadside", side: "starboard", range: a.range, ...(a.bearing !== undefined ? { bearing: a.bearing } : {}), aimHeight: aimHigh ? a.aimHeight : 0 });
        for (let i = 0; i < 60 * 40; i++) sim.step();
      }
      const s = t.ship!;
      return s.rigging + s.sailCloth.reduce((x, y) => x + y, 0) / s.sailCloth.length;
    };
    const high = shoot(true);
    const low = shoot(false);
    expect(high).toBeLessThan(low - 0.1);
  });
});
