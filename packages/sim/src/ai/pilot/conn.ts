import { type GameCommand, type SailLevel } from "@broadside/core";

/** What the pilot orders this moment: a course, a sail plan, commands (board, storm), and whether the order is done. */
export interface Conn {
  readonly course: number | null;
  readonly sails: SailLevel | null;
  readonly commands: readonly GameCommand[];
  readonly done: boolean;
}

export const conn = (course: number | null, sails: SailLevel | null = null, done = false, commands: readonly GameCommand[] = []): Conn => ({ course, sails, commands, done });
