import { type DomainEvent, type Faction, type Relations, REPUTATION, applyDeed, isHostile } from "@broadside/core";
import { type SimWorld } from "../world/world";
import { type EventQueue } from "@broadside/core";

/**
 * Reputation as an Observer (GoF) of domain events: whatever the player does to a faction's
 * ships and forts moves the player's standing by the `REPUTATION` table. Crossing the line of
 * war either way is itself reported (standingChanged). Runs synchronously as events are pushed,
 * so it is part of the deterministic step.
 */
export const watchReputation = (world: SimWorld, events: EventQueue, rel: Relations): void => {
  const isPlayer = (id: number | null): boolean => {
    if (id === null) return false;
    for (const p of world.with("player")) if (p.id === id) return true;
    return false;
  };
  const factionOf = (id: number): Faction | null => {
    for (const e of world.with("ship")) if (e.id === id) return e.ship.faction;
    for (const e of world.with("fort")) if (e.id === id) return e.fort.faction;
    return null;
  };
  const deed = (victim: Faction | null, delta: number): void => {
    if (!victim) return;
    const before = { ...rel };
    for (const f of applyDeed(rel, victim, delta)) {
      const was = isHostile(before[f]);
      const now = isHostile(rel[f]);
      if (was !== now) events.push({ type: "standingChanged", faction: f, hostile: now });
    }
  };
  events.subscribe((e: DomainEvent) => {
    switch (e.type) {
      case "hit":
        if (isPlayer(e.by)) {
          const isFort = [...world.with("fort")].some((f) => f.id === e.ship);
          deed(factionOf(e.ship), isFort ? REPUTATION.fortHit : REPUTATION.hit);
        }
        return;
      case "shipSunk":
        if (isPlayer(e.by)) deed(factionOf(e.ship), REPUTATION.sink);
        return;
      case "boarded":
        if (e.won && isPlayer(e.by)) deed(factionOf(e.ship), REPUTATION.capture);
        return;
      case "fortCaptured":
        if (isPlayer(e.by)) deed(e.from, REPUTATION.fortCaptured);
        return;
      default:
        return;
    }
  });
};
