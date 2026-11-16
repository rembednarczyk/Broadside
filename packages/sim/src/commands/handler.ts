import { type GameCommand } from "@broadside/core";
import { type Entity } from "../world/components";
import { type SimContext } from "../systems/context";

/** A ship entity that has both a body and a ship state. */
export type ShipEntity = Entity & Required<Pick<Entity, "ship" | "body">>;

/** Receiver side of the Command pattern: one handler per command type. */
export type CommandHandler<T extends GameCommand["type"]> = (e: ShipEntity, cmd: Extract<GameCommand, { type: T }>, ctx: SimContext) => void;

export type HandlerTable = { readonly [T in GameCommand["type"]]?: CommandHandler<T> };
