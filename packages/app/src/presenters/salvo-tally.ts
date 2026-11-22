import type { DomainEvent } from "@broadside/core";

/**
 * Hits of the player's last broadside, told once the shot has had time to land (beta test 22.11:
 * the HUD said nothing about a salvo's effect). Observer over the domain events, timed by the
 * simulation's clock: guns fired by the player open a tally, her balls striking another ship
 * add to it, and 2.5 s after the last gun the tally is reported as a notice key with its
 * numbers (`notice.hits|7|14`, filled in by the HUD) and closed. A single gun is not a salvo.
 */
export class SalvoTally {
  private shots = 0;
  private hits = 0;
  private lastShot = -Infinity;

  /** Feeds the events of a step; returns the notice to show, if a tally closed. */
  update(events: readonly DomainEvent[], playerId: number, time: number): string | null {
    for (const e of events) {
      if (e.type === "gunFired" && e.ship === playerId) {
        this.shots++;
        this.lastShot = time;
      } else if (e.type === "hit" && e.by === playerId && e.ship !== playerId && this.shots > 0) {
        this.hits++;
      }
    }
    if (this.shots === 0 || time - this.lastShot < 2.5) return null;
    // Grape and a ball through two parts strike more than once: no more hits than guns fired.
    const notice = this.shots >= 3 ? `notice.hits|${Math.min(this.hits, this.shots)}|${this.shots}` : null;
    this.shots = 0;
    this.hits = 0;
    return notice;
  }
}
