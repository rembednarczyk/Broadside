import { type Entity } from "../../world/components";
import { type World2D, engage } from "../captain";
import { createCaptain } from "../captain-state";
import { type Conn, conn } from "./conn";
import { type PilotOrder } from "./state";

type Engage = Extract<PilotOrder, { kind: "engage" }>;

/**
 * Fighting a ship broadside to broadside for the player: the AI captains' engagement
 * (captain.engage: the doctrine's range, the loaded side abeam, the shot led by its time of
 * flight, the chasers and mortar as they bear), less what stays the player's call: the choice of
 * shot, fire barrels and mines over the stern, and boarding. Done when the enemy strikes or sinks.
 */
export const fightShip = (me: Entity, o: Engage, target: Entity | undefined, w: World2D): Conn => {
  if (!target?.body || !target.ship || target.ship.sinking || target.ship.struck) return conn(null, 2, true);
  const c = { ...createCaptain(me.body!.pos.x, me.body!.pos.z, o.range, "patrol"), side: o.side };
  const cmds = engage(me, c, target, w);
  o.side = c.side;
  let course: number | null = null;
  for (const cmd of cmds) if (cmd.type === "course") course = cmd.heading;
  const sails = cmds.find((cmd) => cmd.type === "sails");
  return conn(course, sails?.type === "sails" ? sails.level : null, false, cmds.filter((cmd) => cmd.type === "fire"));
};
