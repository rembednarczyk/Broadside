import { aimFor, aimForFort, screens } from "@broadside/sim";
import { type GameCommand } from "@broadside/core";
import { type Simulation } from "@broadside/sim";
import { aimOf } from "./aiming";

/**
 * A standing order to the gun captains under simple steering: fire as the guns bear on an enemy
 * close aboard (the period's "fire as she bears"). Under simple steering the player points and the
 * crew sails; a new captain left to herself was sunk by the opening pirates without firing a shot
 * (beta test 19.11). A broadside goes when a hostile ship that has not struck lies in its arc
 * within BEAR_RANGE, laid as the player's own aimed broadside (aimOf); at most once a second per
 * side (guns still reloading stay silent anyway). An enemy fort in the arc within FORT_BEAR_RANGE
 * is fired on too. The player's own orders come first.
 */
const BEAR_RANGE = 260;
/**
 * An enemy fort is fired on from farther (its walls are a big mark, and lying close under them is
 * what kills a ship: beta test 22.11, the captains held fire at forts altogether).
 */
const FORT_BEAR_RANGE = 430;
const EVERY = 1;

export class GunCaptains {
  private next: Record<"port" | "starboard", number> = { port: 0, starboard: 0 };
  /** The captains look four times a second (the arcs' search is not free at every step). */
  private look = 0;

  /** `prefer`: the ship the player has marked as her target (laid on first when she bears). */
  constructor(private readonly sim: Simulation, private readonly playerId: number, private readonly prefer: () => number | null = () => null) {}

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
      const aim = aimFor(me, this.sim.ships(), side, true, this.sim.relations, this.prefer());
      const shipBears = !!aim && aim.range <= BEAR_RANGE && !aim.target.ship!.struck && !aim.target.ship!.sinking;
      const fort = shipBears ? null : aimForFort(me, this.sim.forts(), side, this.sim.relations, screens(this.sim.world));
      if (!shipBears && (!fort || fort.range > FORT_BEAR_RANGE)) continue;
      this.next[side] = t + EVERY;
      const a = aimOf(this.sim, me, "broadside", side, this.prefer());
      out.push({ type: "fire", ship: this.playerId, mount: "broadside", side, range: a.range, ...(a.bearing !== undefined ? { bearing: a.bearing } : {}), aimHeight: a.aimHeight });
    }
    return out;
  }
}
