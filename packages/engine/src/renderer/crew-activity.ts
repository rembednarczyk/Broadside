import { type ShipState, setFactor } from "@broadside/sim";
import { type CrewActivity } from "./crew-roles";

/**
 * What a ship's company is busy with, measured from the simulation each frame for the crew view
 * (crew-roles): yards swinging (the chord of any sail on a mast moved faster than a slow drift),
 * canvas going up or coming in (set short of the order), guns fired and their time since.
 */
const SWING = 0.4 * (Math.PI / 180);

export class CrewActivityTracker {
  private readonly chords: number[][];
  private readonly lastFired = new Map<number, number>();
  private readonly lastHandled = new Map<number, number>();
  private time = 0;
  private bracing: boolean[];

  constructor(state: ShipState) {
    this.chords = state.sailChord.map((m) => [...m]);
    this.bracing = state.sailChord.map(() => false);
  }

  /** The gun `index` fired now. */
  fired(index: number): void {
    if (index >= 0) this.lastFired.set(index, this.time);
  }

  update(s: ShipState, time: number): CrewActivity {
    const dt = time - this.time;
    this.time = time;
    if (dt > 0) {
      this.bracing = s.sailChord.map((m, i) => m.some((c, j) => Math.abs(c - (this.chords[i]![j] ?? c)) > SWING * dt));
      s.sailChord.forEach((m, i) => (this.chords[i] = [...m]));
    }
    const handling = s.sailSet.map((set, i) => Math.abs(set - setFactor(s.sailTarget[i]!, set > 1.01)) > 0.02);
    const now = this.time;
    handling.forEach((h, i) => h && this.lastHandled.set(i, now));
    return {
      bracing: this.bracing,
      handling,
      sinceFired: (gun) => now - (this.lastFired.get(gun) ?? -Infinity),
      sinceHandled: (mast) => now - (this.lastHandled.get(mast) ?? -Infinity),
      beaten: s.struck || s.sinking,
    };
  }
}
