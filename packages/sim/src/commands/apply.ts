import { type GameCommand, clamp, wrapAngle } from "@broadside/core";
import { type Entity } from "../world/components";

/**
 * Applies one command to its ship (Command pattern receiver side). Unknown ships and commands for
 * sunk ships are ignored: a command log stays valid when a ship goes down mid-replay.
 */
export type CommandHandler = (ship: Required<Pick<Entity, "ship" | "body">> & Entity, cmd: GameCommand) => void;

const handlers: Partial<Record<GameCommand["type"], CommandHandler>> = {
  helm: (e, cmd) => {
    if (cmd.type !== "helm") return;
    e.ship.rudderTarget = clamp(cmd.rudder, -1, 1);
    e.ship.course = null;
  },
  course: (e, cmd) => {
    if (cmd.type === "course") e.ship.course = cmd.heading === null ? null : wrapAngle(cmd.heading);
  },
  sails: (e, cmd) => {
    if (cmd.type !== "sails") return;
    if (cmd.mast === "all") e.ship.sailTarget = e.ship.sailTarget.map(() => cmd.level);
    else if (cmd.mast >= 0 && cmd.mast < e.ship.sailTarget.length) e.ship.sailTarget[cmd.mast] = cmd.level;
  },
  oars: (e, cmd) => {
    if (cmd.type === "oars") e.ship.oars = cmd.on;
  },
};

/** Lets later milestones register handlers (combat, boarding) without editing this table. */
export const registerHandler = (type: GameCommand["type"], handler: CommandHandler): void => {
  handlers[type] = handler;
};

export const applyCommand = (e: Entity, cmd: GameCommand): void => {
  if (!e.ship || !e.body || e.ship.sinking) return;
  handlers[cmd.type]?.(e as Required<Pick<Entity, "ship" | "body">> & Entity, cmd);
};
