import { type EventQueue, type Rng, prizeMoney } from "@broadside/core";
import { type Entity } from "../world/components";
import { type Purse, credit } from "../economy/purse";

/**
 * Boarding: grappled alongside, the attacking party (three quarters of the crew) meets the
 * defenders (all hands; a ship that has struck her colours barely resists). The side with the
 * larger effective strength carries the deck; losses fall mostly on the losers. A taken ship
 * yields her whole hold (plunder) and prize money, and some of her men join the victors.
 */
export const BOARD_REACH = 30;
export const BOARD_SPEED = 2.5;

export const canBoard = (me: Entity, target: Entity): boolean => {
  if (target.ship!.sinking || target.id === me.id) return false;
  const a = me.body!;
  const b = target.body!;
  const gap = Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z) - (me.ship!.model.def.hull.beam + target.ship!.model.def.hull.beam) / 2;
  return gap < BOARD_REACH && Math.hypot(a.vel.x - b.vel.x, a.vel.z - b.vel.z) < BOARD_SPEED;
};

export const board = (events: EventQueue, me: Entity, target: Entity, rng: Rng, purse: Purse | null): void => {
  if (!canBoard(me, target)) return;
  const a = me.ship!;
  const d = target.ship!;
  const party = Math.floor(a.crew * 0.75);
  const attack = party * (0.8 + rng.next() * 0.4);
  const defence = d.crew * (d.struck ? 0.25 : 1.15) * (0.8 + rng.next() * 0.4);
  if (attack > defence) {
    const lostA = Math.min(party, Math.ceil(party * 0.35 * (defence / attack)));
    a.crew -= lostA;
    const survivors = Math.max(0, d.crew - Math.ceil(d.crew * 0.6));
    const pressed = Math.min(a.model.def.crew - a.crew, Math.floor(survivors * 0.5));
    a.crew += pressed;
    d.crew = Math.max(0, survivors - pressed);
    d.struck = true;
    if (target.captain) target.captain.mode = "struck";
    d.sailTarget = d.sailTarget.map(() => 0);
    events.push({ type: "boarded", ship: target.id, by: me.id, won: true });
    if (me.player && purse) {
      purse.plunder += Math.floor(d.model.def.hold * 40);
      credit(purse, events, prizeMoney(d.model.def.price, true), "plunder");
    }
  } else {
    const lostA = Math.ceil(party * 0.5);
    a.crew = Math.max(0, a.crew - lostA);
    d.crew = Math.max(0, d.crew - Math.ceil(party * 0.3));
    events.push({ type: "boarded", ship: target.id, by: me.id, won: false });
  }
};
