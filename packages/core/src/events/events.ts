import { type AmmoId } from "../data/ammo";
import { type EntityId, type Side } from "../commands/commands";
import { type Vec3 } from "../math/vec3";
import { type Faction } from "../data/factions";
import { type ContractKind } from "../data/contracts";

/**
 * Domain events (Observer / Event Queue, "Game Programming Patterns" ch. 4 and 15): the simulation
 * reports what happened; renderer, audio and HUD react without the simulation knowing them.
 * Events carry keys and numbers, never player-facing text (i18n lives in the UI).
 */
export type HitPart = "hull" | "sails" | "rigging" | "mast" | "crew" | "gun" | "rudder";

export type DomainEvent =
  | { readonly type: "gunFired"; readonly ship: EntityId; readonly at: Vec3; readonly dir: Vec3; readonly pounder: number; readonly ammo: AmmoId }
  | { readonly type: "splash"; readonly at: Vec3; readonly size: number }
  | { readonly type: "ricochet"; readonly at: Vec3 }
  | { readonly type: "hit"; readonly ship: EntityId; readonly by: EntityId; readonly at: Vec3; readonly part: HitPart; readonly damage: number }
  | { readonly type: "explosion"; readonly at: Vec3; readonly radius: number }
  | { readonly type: "fireStarted"; readonly ship: EntityId; readonly section: number }
  | { readonly type: "fireOut"; readonly ship: EntityId; readonly section: number }
  | { readonly type: "magazineExploded"; readonly ship: EntityId; readonly at: Vec3 }
  | { readonly type: "mastFell"; readonly ship: EntityId; readonly mast: number }
  | { readonly type: "crewOverboard"; readonly ship: EntityId; readonly count: number; readonly at: Vec3 }
  | { readonly type: "crewRescued"; readonly ship: EntityId; readonly count: number }
  | { readonly type: "shipSinking"; readonly ship: EntityId }
  | { readonly type: "shipSunk"; readonly ship: EntityId; readonly by: EntityId | null }
  | { readonly type: "shipStruck"; readonly ship: EntityId; readonly side: Side }
  | { readonly type: "boarded"; readonly ship: EntityId; readonly by: EntityId; readonly won: boolean }
  | { readonly type: "lightning"; readonly at: Vec3 }
  | { readonly type: "fortSilenced"; readonly fort: EntityId; readonly by: EntityId | null }
  | { readonly type: "fortCaptured"; readonly fort: EntityId; readonly by: EntityId; readonly gold: number; readonly from: Faction }
  | { readonly type: "assaultFailed"; readonly fort: EntityId; readonly by: EntityId; readonly lost: number }
  | { readonly type: "gold"; readonly amount: number; readonly reason: "prize" | "fort" | "trade" | "plunder" | "contract" }
  | { readonly type: "tradeRefused"; readonly port: number; readonly reason: "hostile" | "far" | "gold" }
  | { readonly type: "collision"; readonly a: EntityId; readonly b: EntityId; readonly at: Vec3; readonly speed: number; readonly ram: boolean }
  | { readonly type: "grounded"; readonly ship: EntityId; readonly at: Vec3; readonly speed: number }
  | { readonly type: "weatherChanged"; readonly kind: string }
  | { readonly type: "contractAccepted"; readonly kind: ContractKind; readonly target: EntityId }
  | { readonly type: "contractDone"; readonly kind: ContractKind; readonly reward: number }
  | { readonly type: "contractFailed"; readonly kind: ContractKind }
  /** The player's standing with a nation crossed the line of war (either way). */
  | { readonly type: "standingChanged"; readonly faction: Faction; readonly hostile: boolean };

export type DomainEventType = DomainEvent["type"];

/** A typed event queue: the simulation pushes during a step, the app drains after it. */
export class EventQueue {
  private items: DomainEvent[] = [];
  private readonly listeners: ((e: DomainEvent) => void)[] = [];
  /** Observers inside the simulation (reputation) see each event as it is pushed. */
  subscribe(fn: (e: DomainEvent) => void): void {
    this.listeners.push(fn);
  }
  push(e: DomainEvent): void {
    this.items.push(e);
    for (const fn of this.listeners) fn(e);
  }
  drain(): DomainEvent[] {
    const out = this.items;
    this.items = [];
    return out;
  }
  get size(): number {
    return this.items.length;
  }
}
