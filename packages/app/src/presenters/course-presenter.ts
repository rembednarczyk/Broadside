import { type Simulation } from "@broadside/sim";

type P = { x: number; z: number };

/**
 * The route the crew is sailing (simple steering), for the water overlay: from the ship through
 * the points still to come, and the destination ring of a tapped course (a drawn one has none:
 * the ship sails on past its end).
 */
export const presentCourse = (sim: Simulation, playerId: number): { path: P[]; goal: P | null } => {
  const me = sim.byId(playerId);
  const pilot = me?.pilot;
  if (!me?.body || !pilot || pilot.route.length === 0) return { path: [], goal: null };
  const path = [{ x: me.body.pos.x, z: me.body.pos.z }, ...pilot.route.map((p) => ({ x: p.x, z: p.z }))];
  return { path, goal: pilot.hold ? null : path[path.length - 1]! };
};
