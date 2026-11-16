import { beaufort, rollOf, rotateInv, windVector, wrapAngle, yawOf } from "@broadside/core";
import { type Simulation } from "@broadside/sim";
import { type SailingHud } from "@broadside/ui";

/** Reads the player's ship and the wind into the HUD's sailing model (Presenter). */
export const presentSailing = (sim: Simulation, playerId: number): SailingHud | null => {
  const e = sim.byId(playerId);
  if (!e?.body || !e.ship) return null;
  const b = e.body;
  const s = e.ship;
  const v = rotateInv(b.rot, b.vel);
  const heading = yawOf(b.rot);
  const tw = windVector(sim.env.windDirection, sim.env.windSpeed);
  // Wind comes from the opposite of where it blows to.
  const windFrom = Math.atan2(-tw.x, -tw.z);
  return {
    speedKnots: v.z * 1.944,
    heading,
    course: s.course,
    windFromRelative: wrapAngle(windFrom - heading),
    windKnots: sim.env.windSpeed * 1.944,
    beaufort: beaufort(sim.env.windSpeed),
    sailTargets: [...s.sailTarget],
    sailSet: [...s.sailSet],
    heelDeg: (rollOf(b.rot) * 180) / Math.PI,
    hasOars: s.model.def.oars > 0,
    oars: s.oars,
    classId: s.model.def.id,
    weather: sim.env.weather?.kind ?? null,
    mastLoad: [...s.mastLoad],
  };
};
