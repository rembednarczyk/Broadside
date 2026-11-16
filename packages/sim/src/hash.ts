import { hashString, quantize } from "@broadside/core";
import { type Simulation } from "./simulation";

/**
 * Determinism fingerprint (golden hash, as SpinalTap packages/sim/test/determinism.test.ts): the
 * state of every ship rounded to millimetres, hashed. Changing a simulation rule changes it; the
 * commit that updates the golden value says which rule did.
 */
export const stateHash = (sim: Simulation): string => {
  const parts = sim.ships().map((e) => {
    const b = e.body!;
    const s = e.ship!;
    const n = [b.pos.x, b.pos.y, b.pos.z, b.vel.x, b.vel.y, b.vel.z, b.rot.x, b.rot.y, b.rot.z, b.rot.w, s.rudder, ...s.sailSet, ...s.mastHp, s.crew]
      .map((v) => quantize(v, 3))
      .join(",");
    return `${e.id}:${n}`;
  });
  return hashString(`${sim.steps}|${quantize(sim.env.time, 3)}|${parts.join(";")}`).toString(16);
};
