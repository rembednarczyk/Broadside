import { type GameCommand } from "@broadside/core";
import { type Entity } from "../world/components";
import { type SimContext } from "../systems/context";
import { type CommandHandler, type HandlerTable, type ShipEntity } from "./handler";
import { sailingHandlers } from "./sailing-handlers";
import { combatHandlers } from "./combat-handlers";

/**
 * Applies one command to its ship. Unknown ships and commands for sinking ships are ignored: a
 * command log stays valid when a ship goes down mid-replay. The handler table is composed once
 * from the areas' tables (no global registry to mutate).
 */
const HANDLERS: HandlerTable = { ...sailingHandlers, ...combatHandlers };

export const applyCommand = (e: Entity, cmd: GameCommand, ctx: SimContext): void => {
  if (!e.ship || !e.body || e.ship.sinking) return;
  const h = HANDLERS[cmd.type] as CommandHandler<typeof cmd.type> | undefined;
  h?.(e as ShipEntity, cmd as never, ctx);
};
