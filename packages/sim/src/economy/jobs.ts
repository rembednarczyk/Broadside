import { type ContractOffer, type Faction } from "@broadside/core";

/** The contract the player has taken (rules in ./contracts). */
export interface Contract {
  readonly offer: ContractOffer;
  /** Port that gave the contract and its owner then (pays and is pleased). */
  readonly port: number;
  readonly giver: Faction;
  readonly target: number;
  readonly deadline: number;
}

export interface Jobs {
  active: Contract | null;
}
