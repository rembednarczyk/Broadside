import { type DomainEvent } from "@broadside/core";

/**
 * Vibration on the phone (Capacitor Haptics; on the web the Vibration API): felt feedback of what
 * the ship does and suffers, as console games rumble. The choice of pulse per event is pure (the
 * Observer of the event queue maps events to cues, as the sound does); the adapter plays it.
 * Light for the own guns, medium for a hit on the own ship or running aground, heavy for a mast
 * going, a magazine, a collision under way.
 */
export type Pulse = "light" | "medium" | "heavy";

/** Shots of one broadside come in a ripple: one pulse per this many seconds at most. */
export const MIN_GAP = 0.12;

export const pulseFor = (e: DomainEvent, playerId: number): Pulse | null => {
  switch (e.type) {
    case "gunFired":
      return e.ship === playerId ? "light" : null;
    case "hit":
      return e.ship === playerId ? (e.damage > 30 ? "heavy" : "medium") : null;
    case "mastFell":
    case "magazineExploded":
      return e.ship === playerId ? "heavy" : null;
    case "grounded":
      return e.ship === playerId ? "medium" : null;
    case "collision":
      return e.a === playerId || e.b === playerId ? "heavy" : null;
    default:
      return null;
  }
};

/** The strongest pulse of a frame's events (one vibration a frame, not a buzz). */
export const strongest = (events: readonly DomainEvent[], playerId: number): Pulse | null => {
  const rank = { light: 1, medium: 2, heavy: 3 } as const;
  let best: Pulse | null = null;
  for (const e of events) {
    const p = pulseFor(e, playerId);
    if (p && (!best || rank[p] > rank[best])) best = p;
  }
  return best;
};

/** Plays pulses on the device, no more often than MIN_GAP; silent where there is nothing to vibrate. */
export class Haptics {
  private last = -Infinity;
  enabled = true;

  play(pulse: Pulse | null, now: number): void {
    if (!pulse || !this.enabled || now - this.last < MIN_GAP) return;
    this.last = now;
    // The native plugin on Android (loaded on first use); else the browser's vibration, if any.
    void import("@capacitor/haptics")
      .then(({ Haptics: H, ImpactStyle }) => H.impact({ style: pulse === "light" ? ImpactStyle.Light : pulse === "medium" ? ImpactStyle.Medium : ImpactStyle.Heavy }))
      .catch(() => {
        const ms = pulse === "light" ? 15 : pulse === "medium" ? 35 : 70;
        (globalThis.navigator as Navigator | undefined)?.vibrate?.(ms);
      });
  }
}
