import { wrapAngle, yawOf } from "@broadside/core";
import { type HandlerTable } from "./handler";
import { loadAmmo, orderFire } from "../combat/gunnery";
import { drop } from "../combat/drops";

/** Bracing for impact: the crew takes cover for a few seconds (less damage, no firing). */
const BRACE_SECONDS = 3;

export const combatHandlers: HandlerTable = {
  fire: (e, cmd, ctx) => {
    if (e.ship.braced > 0 || e.ship.struck) return;
    // Training: the bearing relative to each gun's mounting is resolved per battery side.
    const heading = yawOf(e.body.rot);
    const sideDir = cmd.side === "port" ? -Math.PI / 2 : cmd.side === "starboard" ? Math.PI / 2 : cmd.mount === "sternChaser" ? Math.PI : 0;
    const train = cmd.bearing === undefined ? 0 : wrapAngle(cmd.bearing - heading - sideDir);
    orderFire(e.ship, cmd.mount, cmd.side, cmd.range, ctx.rng, train);
  },
  loadAmmo: (e, cmd) => loadAmmo(e.ship, cmd.mount, cmd.ammo),
  drop: (e, cmd, ctx) => {
    drop(ctx.world, ctx.events, e, cmd.ammo);
  },
  brace: (e) => {
    e.ship.braced = BRACE_SECONDS;
  },
};
