import { wrapAngle, yawOf } from "@broadside/core";
import { type Entity } from "../../world/components";
import { type Conn, conn } from "./conn";
import { type Sea, steerFor } from "./seamanship";
import { type PilotState } from "./state";

/** Storming reach beyond the fort's walls (combat/forts.assault takes 200 m), with a margin. */
const STAND_OFF = 150;
/**
 * Where to lie while the fort still fights: about 400 m off its walls, where its guns lose most
 * of their aim (beta test 22.11: heaving to at 150 m put the ship where the fort hit 95–100%).
 */
const BOMBARD_OFF = 400;

/**
 * Closing a fort: sail for the point on the line from the fort to the ship (over the water she
 * came by); while the fort fights, lie there about 400 m off with it abeam and let the guns
 * (the player's, or her gun captains') do the work; once it is silenced, stand in to storming
 * distance and storm it (combat/forts.assault). Done when the fort is ours or the storm is ordered.
 */
export const closeFort = (me: Entity, p: PilotState, fort: Entity | undefined, sea: Sea): Conn => {
  const f = fort?.fort;
  if (!f || f.faction === me.ship!.faction) return conn(null, null, true);
  const b = me.body!;
  const dx = b.pos.x - f.site.x;
  const dz = b.pos.z - f.site.z;
  const d = Math.hypot(dx, dz) || 1;
  const reach = f.def.radius + (f.silenced ? STAND_OFF : BOMBARD_OFF);
  if (d <= reach + 10) {
    if (f.silenced) return conn(null, 0, true, [{ type: "assault", ship: me.id, fort: fort!.id }]);
    // On station: the fort abeam on whichever side turns her least, under bare poles.
    const brg = Math.atan2(-dx, -dz);
    const yaw = yawOf(b.rot);
    const port = wrapAngle(brg + Math.PI / 2);
    const starboard = wrapAngle(brg - Math.PI / 2);
    const course = Math.abs(wrapAngle(port - yaw)) < Math.abs(wrapAngle(starboard - yaw)) ? port : starboard;
    return conn(course, 0, false);
  }
  return conn(steerFor(me, p, f.site.x + (dx / d) * reach, f.site.z + (dz / d) * reach, sea), 3);
};
