import { type Entity } from "../../world/components";
import { type World2D } from "../captain";
import { type Conn } from "./conn";
import { type PilotState } from "./state";
import { sailRoute } from "./route";
import { runDown } from "./board";
import { followShip } from "./follow";
import { closeFort } from "./assault";
import { lieOverWreck } from "./salvage";
import { fightShip } from "./engage";

/**
 * Simple steering (the player points, the crew sails): one order per ship, conned twice a
 * second. The order's kind picks its seamanship (Strategy by data; each kind its own module, the
 * shared skill of steering for a point in seamanship.ts); the system (systems/pilot) carries
 * out the result. No random source: the same orders give the same voyage.
 */
/** What the pilot sees: the AI captains' view of the sea (wind, seabed, ships, forts, smoke). */
export type PilotWorld = World2D;

/** The pilot looks at the order twice a second, as the AI captains do. */
export const PILOT_THINK = 0.5;

export const conning = (me: Entity, p: PilotState, w: PilotWorld): Conn => {
  const o = p.order;
  switch (o.kind) {
    case "route":
      return sailRoute(me, p, o, w);
    case "board":
      return runDown(me, p, w.ships.find((s) => s.id === o.target), w);
    case "follow":
      return followShip(me, w.ships.find((s) => s.id === o.target), w);
    case "engage":
      return fightShip(me, o, w.ships.find((s) => s.id === o.target), w);
    case "assault":
      return closeFort(me, p, w.forts.find((f) => f.id === o.fort), w);
    case "salvage":
      return lieOverWreck(me, p, o.at, w);
  }
};
