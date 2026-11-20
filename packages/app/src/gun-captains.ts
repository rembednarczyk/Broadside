import { aimFor } from "@broadside/sim";
import { type GameCommand } from "@broadside/core";
import { type Simulation } from "@broadside/sim";
import { aimOf } from "./aiming";

/**
 * A standing order to the gun captains under simple steering: fire as the guns bear on an enemy
 * close aboard (the period's "fire as she bears"). Under simple steering the player points and the
 * crew sails; a new captain left to herself was sunk by the opening pirates without firing a shot
 * (beta test 19.11). A broadside goes when a hostile ship that has not struck lies in its arc
 * within BEAR_RANGE, laid as the player's own aimed broadside (aimOf); at most once a second per
 * side (guns still reloading stay silent anyway). The player's own orders come first.
 */
const BEAR_RANGE = 260;
const EVERY = 1;

export class GunCaptains {
  private next: Record<"port" | "starboard", number> = { port: 0, starboard: 0 };
  /** The captains look four times a second (the arcs' search is not free at every step). */
  private look = 0;

  constructor(private readonly sim: Simulation, private readonly playerId: number) {}

  /** The orders for this moment (empty when nothing bears). */
  orders(): GameCommand[] {
    const me = this.sim.byId(this.playerId);
    if (!me?.body || !me.ship || me.ship.sinking) return [];
    const t = this.sim.env.time;
    if (t < this.look) return [];
    this.look = t + 0.25;
    const out: GameCommand[] = [];
    for (const side of ["port", "starboard"] as const) {
      if (t < this.next[side]) continue;
      const aim = aimFor(me, this.sim.ships(), side, true, this.sim.relations);
      if (!aim || aim.range > BEAR_RANGE || aim.target.ship!.struck || aim.target.ship!.sinking) continue;
      this.next[side] = t + EVERY;
      const a = aimOf(this.sim, me, "broadside", side);
      out.push({ type: "fire", ship: this.playerId, mount: "broadside", side, range: a.range, ...(a.bearing !== undefined ? { bearing: a.bearing } : {}), aimHeight: a.aimHeight });
    }
    return out;
  }
}
