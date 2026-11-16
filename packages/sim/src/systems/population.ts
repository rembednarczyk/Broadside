import { type System } from "./context";
import { DIRECTOR, directPopulation } from "../world/director";

/**
 * Runs the population director every few seconds of simulated time. The pass is keyed to the
 * clock (no state of its own), so a saved game resumes on the same beat.
 */
export const populationSystem: System = (ctx, dt) => {
  if (!ctx.traffic) return;
  const t = ctx.env.time;
  if (Math.floor(t / DIRECTOR.period) === Math.floor((t - dt) / DIRECTOR.period)) return;
  directPopulation(ctx);
};
