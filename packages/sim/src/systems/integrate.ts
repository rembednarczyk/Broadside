import { type System } from "./context";
import { integrate } from "../physics/rigid-body";

export const integrateSystem: System = (ctx, dt) => {
  for (const e of ctx.world.with("body")) integrate(e.body, dt);
};
