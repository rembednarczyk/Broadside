import { windVector } from "@broadside/core";
import { type System } from "./context";
import { SMOKE } from "../combat/smoke";

/** Smoke screens drift downwind and are gone after their life (rain beats them down faster). */
export const smokeSystem: System = (ctx, dt) => {
  const w = windVector(ctx.env.windDirection, ctx.env.windSpeed);
  const rain = ctx.env.weather?.rain ?? 0;
  for (const e of [...ctx.world.with("smoke")]) {
    const s = e.smoke;
    s.age += dt * (1 + rain);
    s.x += w.x * SMOKE.drift * dt;
    s.z += w.z * SMOKE.drift * dt;
    if (s.age > SMOKE.life) ctx.world.remove(e);
  }
};
