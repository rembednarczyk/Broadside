import { type System } from "./context";
import { judgeContract } from "../economy/contracts";

/** Judges the player's contract every step (success, failure, deadline). */
export const contractSystem: System = (ctx) => {
  judgeContract(ctx);
};
