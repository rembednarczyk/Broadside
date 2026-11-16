import { clamp, wrapAngle } from "@broadside/core";
import { type HandlerTable } from "./handler";

export const sailingHandlers: HandlerTable = {
  helm: (e, cmd) => {
    e.ship.rudderTarget = clamp(cmd.rudder, -1, 1);
    e.ship.course = null;
  },
  course: (e, cmd) => {
    e.ship.course = cmd.heading === null ? null : wrapAngle(cmd.heading);
  },
  sails: (e, cmd) => {
    if (cmd.mast === "all") e.ship.sailTarget = e.ship.sailTarget.map(() => cmd.level);
    else if (cmd.mast >= 0 && cmd.mast < e.ship.sailTarget.length) e.ship.sailTarget[cmd.mast] = cmd.level;
  },
  oars: (e, cmd) => {
    e.ship.oars = cmd.on;
  },
};
