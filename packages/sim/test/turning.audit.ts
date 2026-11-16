import { it } from "vitest";
import { SHIP_CLASS_IDS, rotateInv, yawOf } from "@broadside/core";
import { Simulation } from "../src/simulation";

/** Turning audit: steady yaw rate and turning circle (in hull lengths) at full helm, beam reach. */
it("turning circles of every class (report)", () => {
  for (const id of SHIP_CLASS_IDS) {
    const sim = new Simulation({ seed: 4, windDirection: Math.PI / 2, windSpeed: 9 });
    const e = sim.spawnShip({ classId: id, faction: "player", x: 0, z: 0, heading: 0 });
    for (let i = 0; i < 60 * 60; i++) sim.step();
    const v0 = rotateInv(e.body!.rot, e.body!.vel).z;
    sim.command({ type: "helm", ship: e.id, rudder: 1 });
    for (let i = 0; i < 60 * 8; i++) sim.step();
    const y0 = yawOf(e.body!.rot);
    for (let i = 0; i < 60 * 10; i++) sim.step();
    let dy = yawOf(e.body!.rot) - y0;
    if (dy < -Math.PI) dy += 2 * Math.PI;
    const rate = dy / 10;
    const v = Math.hypot(e.body!.vel.x, e.body!.vel.z);
    console.log(id.padEnd(9), `v0 ${v0.toFixed(1)} m/s  turn ${(rate * 57.3).toFixed(1)} deg/s  circle ${(v / Math.max(rate, 1e-3) / e.ship!.model.def.hull.length).toFixed(1)} L  v ${v.toFixed(1)}`);
  }
});
