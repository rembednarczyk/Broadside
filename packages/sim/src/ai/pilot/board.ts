import { type SailLevel } from "@broadside/core";
import { type Entity } from "../../world/components";
import { canBoard } from "../../combat/boarding";
import { type Conn, conn } from "./conn";
import { type Sea, steerFor } from "./seamanship";
import { type PilotState } from "./state";

/** Seconds of lead at most: beyond that the chase is long and the target will have turned anyway. */
const MAX_LEAD = 30;

/**
 * Running a ship down and boarding her: pursuit with lead (steer for where she will be when we
 * close at our speed, Reynolds' "pursuit", 1999), the canvas shortened as the gap closes so that
 * we come alongside at her speed (grapples hold only below BOARD_SPEED of difference), and the
 * boarding party sent across as soon as it can be (combat/boarding.canBoard).
 */
export const runDown = (me: Entity, p: PilotState, target: Entity | undefined, sea: Sea): Conn => {
  if (!target?.body || !target.ship || target.ship.sinking) return conn(null, 1, true);
  if (canBoard(me, target)) return conn(null, 1, true, [{ type: "board", ship: me.id, target: target.id }]);
  const a = me.body!;
  const t = target.body;
  const gap = Math.hypot(t.pos.x - a.pos.x, t.pos.z - a.pos.z) - (me.ship!.model.def.hull.beam + target.ship.model.def.hull.beam) / 2;
  const lead = Math.min(MAX_LEAD, gap / Math.max(1, Math.hypot(a.vel.x, a.vel.z)));
  const closing = Math.hypot(a.vel.x - t.vel.x, a.vel.z - t.vel.z);
  const sails: SailLevel = gap > 160 ? 3 : gap > 70 ? 2 : closing > 3 ? 0 : 1;
  return conn(steerFor(me, p, t.pos.x + t.vel.x * lead, t.pos.z + t.vel.z * lead, sea), sails);
};
