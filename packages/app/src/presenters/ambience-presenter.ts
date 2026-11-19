import { CELLS, cellInfluence, rollOf, shoreDistance } from "@broadside/core";
import { type Simulation, rainAt } from "@broadside/sim";
import { type Ambience } from "@broadside/engine";

/**
 * What the ambience mixer needs to know about the weather and the ship at the listener (Presenter):
 * the local wind (storm cells blow harder), rain, how stormy, how near the shore, how hard the
 * player's ship is working (her timbers creak with the heel).
 */
export const presentAmbience = (sim: Simulation, x: number, z: number, playerId: number): Ambience => {
  const env = sim.env;
  const cell = cellInfluence(env.cells, x, z);
  const kind = env.weather?.kind;
  const storm = Math.max(kind === "storm" ? 1 : kind === "gale" ? 0.6 : kind === "squally" ? 0.3 : 0, cell > 0.5 ? cell : 0);
  let land = 0;
  for (const is of env.archipelago?.islands ?? []) {
    const d = shoreDistance(is, x, z);
    land = Math.max(land, Math.min(1, Math.max(0, 1 - d / 500)));
  }
  const me = sim.byId(playerId);
  const strain = me?.body ? Math.min(1, Math.abs(rollOf(me.body.rot)) / 0.3) : 0;
  return { windSpeed: env.windSpeed * (1 + CELLS.gust * cell), rain: rainAt(env, x, z), storm, land, strain };
};
