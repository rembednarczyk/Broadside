import { type Simulation } from "@broadside/sim";

/**
 * What the player has marked, apart from the simulation (a view of her intent, not saved): the
 * ship chosen as her target (a tap on her; the same tap again clears it), on which the guns lay
 * first and which the target panel and the isometric camera follow, cleared when she sinks or
 * strikes; and the waypoint flag set on the chart, which the compass points to.
 */
export class PlayerMarks {
  focus: number | null = null;
  waypoint: { x: number; z: number } | null = null;

  constructor(private readonly sim: Simulation) {}

  /** Marks a ship as the target, or clears the mark when she is already marked. */
  toggleFocus(id: number): void {
    this.focus = this.focus === id ? null : id;
  }

  /** The marked ship while she still fights, else none. */
  marked(): number | null {
    const t = this.focus === null ? null : this.sim.byId(this.focus);
    if (!t?.ship || t.ship.sinking || t.ship.struck) this.focus = null;
    return this.focus;
  }
}
