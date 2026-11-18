import { clamp, wrapAngle } from "@broadside/core";
import { type HandlerTable } from "./handler";
import { CRUISING, createPilot } from "../ai/pilot";

export const sailingHandlers: HandlerTable = {
  // The helm or a course from the player takes the wheel back from the pilot (simple steering).
  helm: (e, cmd, ctx) => {
    e.ship.rudderTarget = clamp(cmd.rudder, -1, 1);
    e.ship.course = null;
    if (e.pilot) ctx.world.removeComponent(e, "pilot");
  },
  course: (e, cmd, ctx) => {
    e.ship.course = cmd.heading === null ? null : wrapAngle(cmd.heading);
    if (e.pilot) ctx.world.removeComponent(e, "pilot");
  },
  navigate: (e, cmd, ctx) => {
    if (e.pilot) ctx.world.removeComponent(e, "pilot");
    if (cmd.route.length === 0) return;
    ctx.world.addComponent(e, "pilot", createPilot(cmd.route, cmd.hold, e.ship.course ?? 0, e.body.pos));
    // With no canvas spread the crew makes sail to get under way.
    if (e.ship.sailTarget.every((l) => l === 0)) e.ship.sailTarget = e.ship.sailTarget.map(() => CRUISING);
  },
  sails: (e, cmd) => {
    if (cmd.mast === "all") e.ship.sailTarget = e.ship.sailTarget.map(() => cmd.level);
    else if (cmd.mast >= 0 && cmd.mast < e.ship.sailTarget.length) e.ship.sailTarget[cmd.mast] = cmd.level;
  },
  oars: (e, cmd) => {
    e.ship.oars = cmd.on;
  },
};
