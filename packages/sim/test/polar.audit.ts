import { it } from "vitest";
import { SHIP_CLASS_IDS, rollOf, rotateInv, yawOf } from "@broadside/core";
import { Simulation } from "../src/simulation";

it("speed polar, leeway, heel and step cost of every class (report)", () => {
  for (const id of SHIP_CLASS_IDS) {
    const row: string[] = [];
    for (const off of [45, 60, 75, 90, 135, 180]) {
      // heading 0; wind blowing towards angle such that wind comes from `off` deg off the bow
      const windDir = Math.PI - (off * Math.PI) / 180;
      const sim = new Simulation({ seed: 3, windDirection: windDir, windSpeed: 8 });
      const e = sim.spawnShip({ classId: id, faction: "player", x: 0, z: 0, heading: 0 });
      // The helmsman holds the heading, so each column is one point of sail.
      sim.command({ type: "course", ship: e.id, heading: 0 });
      let heel = 0;
      for (let i = 0; i < 60 * 90; i++) { sim.step(); heel = Math.max(heel, Math.abs(rollOf(e.body!.rot))); }
      const v = rotateInv(e.body!.rot, e.body!.vel);
      row.push(`${off}°: ${(v.z * 1.944).toFixed(1)}kn lee ${(Math.atan2(v.x, v.z) * 57.3).toFixed(0)}° heel ${(heel * 57.3).toFixed(0)}° yaw ${(yawOf(e.body!.rot) * 57.3).toFixed(0)}`);
    }
    console.log(id.padEnd(9), row.join(" | "));
  }
  const t0 = process.hrtime.bigint();
  const sim = new Simulation({ seed: 3, windDirection: 1, windSpeed: 8 });
  for (let k = 0; k < 10; k++) sim.spawnShip({ classId: "frigate", faction: "player", x: k * 80, z: 0, heading: 0 });
  for (let i = 0; i < 600; i++) sim.step();
  console.log("10 frigates, ms per step:", Number(process.hrtime.bigint() - t0) / 1e6 / 600);
});
