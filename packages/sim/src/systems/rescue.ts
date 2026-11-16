import { type System } from "./context";
import { rescuePlayer } from "../ship/rescue";

/**
 * The captain is rescued (see ship/rescue) just before a sunk player ship would be removed, or as
 * soon as no one is left aboard to work her (a derelict cannot be sailed or fought).
 */
export const rescueSystem: System = (ctx, dt) => {
  for (const e of [...ctx.world.with("player", "ship", "body")]) {
    const sunk = e.ttl !== undefined && e.ttl <= dt * 2;
    const abandoned = !e.ship.sinking && e.ship.crew <= 0;
    if (sunk || abandoned) rescuePlayer(ctx, e);
  }
};
