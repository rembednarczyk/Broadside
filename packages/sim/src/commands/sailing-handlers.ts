import { clamp, wrapAngle } from "@broadside/core";
import { type HandlerTable } from "./handler";
import { type PilotOrder } from "../ai/pilot/state";
import { type ShipEntity } from "./handler";
import { type SimContext } from "../systems/context";

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
    const o = e.pilot?.order;
    if (cmd.append && o?.kind === "route" && cmd.route.length > 0) {
      o.route.push(...cmd.route.map((p) => ({ x: p.x, z: p.z })));
      o.hold = cmd.hold;
      return;
    }
    if (cmd.route.length === 0) {
      if (e.pilot) ctx.world.removeComponent(e, "pilot");
      return;
    }
    givePilot(e, ctx, { kind: "route", route: cmd.route.map((p) => ({ x: p.x, z: p.z })), hold: cmd.hold, heading: e.ship.course ?? 0, from: { x: e.body.pos.x, z: e.body.pos.z } });
  },
  pilot: (e, cmd, ctx) => {
    const o = cmd.order;
    givePilot(e, ctx, o.kind === "assault" ? { kind: "assault", fort: o.fort } : o.kind === "engage" ? { kind: "engage", target: o.target, side: "starboard", range: ENGAGE_RANGE } : { kind: o.kind, target: o.target });
  },
  sails: (e, cmd) => {
    if (cmd.mast === "all") e.ship.sailTarget = e.ship.sailTarget.map(() => cmd.level);
    else if (cmd.mast >= 0 && cmd.mast < e.ship.sailTarget.length) e.ship.sailTarget[cmd.mast] = cmd.level;
  },
  oars: (e, cmd) => {
    e.ship.oars = cmd.on;
  },
};

/** The range the player's gunners fight at (m): the AI's middle range, inside the guns' effective reach. */
const ENGAGE_RANGE = 220;

/** Sail made when an order is given to a ship with none set: full sail, the AI's cruising plan. */
const CRUISING = 3;

/** Hands the ship to the pilot with a new order (simple steering, ai/pilot). */
const givePilot = (e: ShipEntity, ctx: SimContext, order: PilotOrder): void => {
  if (e.pilot) ctx.world.removeComponent(e, "pilot");
  ctx.world.addComponent(e, "pilot", { order, think: 0 });
  // With no canvas spread the crew makes sail to get under way.
  if (e.ship.sailTarget.every((l) => l === 0)) e.ship.sailTarget = e.ship.sailTarget.map(() => CRUISING);
};
