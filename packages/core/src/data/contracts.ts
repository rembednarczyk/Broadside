import { subRng } from "../math/rng";
import { type Faction } from "./factions";
import { type ShipClassId, SHIP_CLASSES } from "./ship-classes";

/**
 * Contracts a harbour master offers (Type Object table plus a seeded generator). Bounty: take or
 * sink a named ship. Escort: see a merchantman safe into another port. Raid (pirate havens): take
 * a nation's merchantman. The offer of a port changes every `CONTRACT_EPOCH` seconds and is the
 * same for the same seed, port and epoch (no state to save until one is accepted).
 */
export type ContractKind = "bounty" | "escort" | "raid";

export interface ContractOffer {
  readonly kind: ContractKind;
  /** Who the target or the escorted ship sails for. */
  readonly faction: Faction;
  readonly classId: ShipClassId;
  /** Gold paid on success. */
  readonly reward: number;
  /** Seconds to finish. */
  readonly time: number;
  /** Port an escort must reach (index), -1 otherwise. */
  readonly dest: number;
}

export const CONTRACT_EPOCH = 300;

const KINDS: Readonly<Record<ContractKind, { readonly classes: readonly ShipClassId[]; readonly rewardPerCrew: number; readonly time: number }>> = {
  bounty: { classes: ["sloop", "schooner", "brig", "frigate"], rewardPerCrew: 22, time: 900 },
  escort: { classes: ["sloop", "schooner", "brig", "galleon"], rewardPerCrew: 14, time: 1800 },
  raid: { classes: ["sloop", "schooner", "brig", "galleon"], rewardPerCrew: 12, time: 900 },
};

const NATIONS: readonly Faction[] = ["crown", "republic", "empire"];

export const contractOffer = (seed: number, port: number, epoch: number, owner: Faction, ports: number): ContractOffer => {
  const rng = subRng(seed, `contract-${port}-${epoch}`);
  const kind: ContractKind = owner === "pirates" ? "raid" : rng.next() < 0.55 ? "bounty" : "escort";
  const k = KINDS[kind];
  const classId = k.classes[Math.floor(rng.next() * k.classes.length)]!;
  const faction: Faction = kind === "bounty" ? "pirates" : kind === "escort" ? owner : NATIONS[Math.floor(rng.next() * NATIONS.length)]!;
  let dest = -1;
  if (kind === "escort" && ports > 1) {
    dest = Math.floor(rng.next() * (ports - 1));
    if (dest >= port) dest++;
  }
  const reward = Math.round((SHIP_CLASSES[classId].crew * k.rewardPerCrew * (0.8 + rng.next() * 0.4)) / 10) * 10;
  return { kind, faction, classId, reward, time: k.time, dest };
};
