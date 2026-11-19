import { clamp, terrainHeight, wrapAngle } from "@broadside/core";
import { type HandlerTable } from "./handler";
import { type PilotOrder } from "../ai/pilot/state";
import { gridBed, planRoute } from "../ai/pilot/plan";
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
      const last = o.route[o.route.length - 1] ?? { x: e.body.pos.x, z: e.body.pos.z };
      o.route.push(...planRoute(bedOf(ctx), last, cmd.route, keelOf(e)));
      o.hold = cmd.hold;
      return;
    }
    if (cmd.route.length === 0) {
      if (e.pilot) ctx.world.removeComponent(e, "pilot");
      return;
    }
    // Round the islands where a leg runs over land or a shoal (A*, ai/pilot/plan).
    const from = { x: e.body.pos.x, z: e.body.pos.z };
    const route = planRoute(bedOf(ctx), from, cmd.route, keelOf(e));
    givePilot(e, ctx, { kind: "route", route, hold: cmd.hold, heading: e.ship.course ?? 0, from });
  },
  pilot: (e, cmd, ctx) => {
    const o = cmd.order;
    givePilot(e, ctx, o.kind === "assault" ? { kind: "assault", fort: o.fort } : o.kind === "salvage" ? { kind: "salvage", at: { x: o.x, z: o.z } } : o.kind === "engage" ? { kind: "engage", target: o.target, side: "starboard", range: ENGAGE_RANGE } : { kind: o.kind, target: o.target });
  },
  anchor: (e, cmd, ctx) => {
    if (!cmd.down) {
      if (e.anchor) ctx.world.removeComponent(e, "anchor");
      return;
    }
    if (!e.anchor) ctx.world.addComponent(e, "anchor", { x: e.body.pos.x, z: e.body.pos.z });
  },
  sails: (e, cmd, ctx) => {
    // Making sail weighs the anchor first.
    if (cmd.level > 0 && e.anchor && !e.pilot) ctx.world.removeComponent(e, "anchor");
    if (cmd.mast === "all") e.ship.sailTarget = e.ship.sailTarget.map(() => cmd.level);
    else if (cmd.mast >= 0 && cmd.mast < e.ship.sailTarget.length) e.ship.sailTarget[cmd.mast] = cmd.level;
    // The captain's own order is what a reefing crew makes sail back up to.
    if (e.reefing) e.reefing.wanted = [...e.ship.sailTarget];
  },
  crew: (e, cmd, ctx) => {
    if (!cmd.reef) {
      if (e.reefing) ctx.world.removeComponent(e, "reefing");
      return;
    }
    if (!e.reefing) ctx.world.addComponent(e, "reefing", { wanted: [...e.ship.sailTarget], easy: e.ship.sailTarget.map(() => 0), think: 0 });
  },
  assist: (e, cmd, ctx) => {
    if (!cmd.on) {
      if (e.assist) ctx.world.removeComponent(e, "assist");
      return;
    }
    if (e.assist) e.assist.astern = !!cmd.astern;
    else ctx.world.addComponent(e, "assist", { astern: !!cmd.astern });
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
  if (e.anchor) ctx.world.removeComponent(e, "anchor");
  ctx.world.addComponent(e, "pilot", { order, think: 0 });
  // With no canvas spread the crew makes sail to get under way.
  if (e.ship.sailTarget.every((l) => l === 0)) e.ship.sailTarget = e.ship.sailTarget.map(() => CRUISING);
};

/** The seabed of the archipelago (null: open sea). */
const bedOf = (ctx: SimContext): ((x: number, z: number) => number) | null => {
  const a = ctx.env.archipelago;
  return a ? gridBed(a, (x, z) => terrainHeight(a, x, z)) : null;
};

/** The seabed must lie below this for the ship to pass: her draught and two metres under the keel (as captain.clearHeading). */
const keelOf = (e: ShipEntity): number => -e.ship.model.def.hull.draft - 2;
