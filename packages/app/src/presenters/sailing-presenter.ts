import { CELLS, beaufort, cellInfluence, rollOf, terrainHeight, rotateInv, windVector, wrapAngle, yawOf } from "@broadside/core";
import { type Simulation } from "@broadside/sim";
import { type SailingHud } from "@broadside/ui";

/**
 * The leadsman's warning: the seabed along the course within a few cable lengths comes up to the
 * keel (the same probe the AI captains steer by).
 */
const LEAD = [40, 90, 160, 250];
const shoalAhead = (sim: Simulation, x: number, z: number, heading: number, draft: number): boolean => {
  const a = sim.env.archipelago;
  if (!a) return false;
  return LEAD.some((d) => terrainHeight(a, x + Math.sin(heading) * d, z + Math.cos(heading) * d) > -draft - 1.5);
};

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
  const cell = cellInfluence(sim.env.cells, b.pos.x, b.pos.z);
  const localWind = sim.env.windSpeed * (1 + CELLS.gust * cell);
  return {
    speedKnots: v.z * 1.944,
    heading,
    course: s.course,
    windFromRelative: wrapAngle(windFrom - heading),
    windKnots: localWind * 1.944,
    beaufort: beaufort(localWind),
    sailTargets: [...s.sailTarget],
    sailSet: [...s.sailSet],
    heelDeg: (rollOf(b.rot) * 180) / Math.PI,
    hasOars: s.model.def.oars > 0,
    oars: s.oars,
    classId: s.model.def.id,
    // Under a storm cell the captain is in a squall, whatever the open sea is doing.
    weather: cell > 0.3 ? "squally" : (sim.env.weather?.kind ?? null),
    mastLoad: [...s.mastLoad],
    shoalAhead: shoalAhead(sim, b.pos.x, b.pos.z, heading, s.model.def.hull.draft),
  };
};
