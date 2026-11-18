import { type Entity } from "../../world/components";
import { type Conn, conn } from "./conn";
import { type Sea, steerFor } from "./seamanship";
import { type PilotState } from "./state";

/** Storming reach beyond the fort's walls (combat/forts.assault takes 200 m), with a margin. */
const STAND_OFF = 150;

/**
 * Closing a fort: sail for the point on the line from the fort to the ship at storming distance;
 * there, storm the fort if its guns are silenced (combat/forts.assault), else heave to under
 * bare poles and let the player bombard it.
 */
export const closeFort = (me: Entity, p: PilotState, fort: Entity | undefined, sea: Sea): Conn => {
  const f = fort?.fort;
  if (!f) return conn(null, null, true);
  const b = me.body!;
  const dx = b.pos.x - f.site.x;
  const dz = b.pos.z - f.site.z;
  const d = Math.hypot(dx, dz) || 1;
  const reach = f.def.radius + STAND_OFF;
  if (d <= reach + 10) return conn(null, 0, true, f.silenced ? [{ type: "assault", ship: me.id, fort: fort!.id }] : []);
  return conn(steerFor(me, p, f.site.x + (dx / d) * reach, f.site.z + (dz / d) * reach, sea), 3);
};
