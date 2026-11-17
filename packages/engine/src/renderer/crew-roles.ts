import { type CrewRole } from "./crew-layout";

/**
 * What each man is doing (pure, tested): the clip a station plays, from what the ship is doing
 * now. State pattern by data: a station's role and the ship's activity give the clip; nothing is
 * kept between frames except the activity itself, which ship-view measures from the simulation:
 * the yards swinging (bracing, D1), canvas being set or taken in, guns fired and reloading.
 */
export type CrewClipName = "idle" | "talk" | "haul" | "wheel" | "work" | "handle" | "lookout";

export interface CrewActivity {
  /** The yards of this mast are being braced round (index of mast; empty: none). */
  readonly bracing: readonly boolean[];
  /** Sail is being set or taken in on this mast. */
  readonly handling: readonly boolean[];
  /** Seconds since this gun last fired (Infinity: not since the ship came close). */
  readonly sinceFired: (gun: number) => number;
  /** The ship has struck her colours or is sinking: the men stand idle. */
  readonly beaten: boolean;
}

/** How long a gun crew is busy after a shot: sponging, loading, running out. */
export const RELOAD_WORK = 18;

/** A station's clip; `i` (the station's number) varies the idle men between standing and talking. */
export const crewClip = (role: CrewRole, of: number, i: number, a: CrewActivity): CrewClipName => {
  const rest: CrewClipName = i % 3 === 1 ? "talk" : "idle";
  if (a.beaten) return rest;
  switch (role) {
    case "wheel":
      return "wheel";
    case "lookout":
      return "lookout";
    case "gun":
      return a.sinceFired(of) < RELOAD_WORK ? "handle" : rest;
    case "halyard":
      return a.handling[of] ? "haul" : a.bracing[of] ? "haul" : rest;
    case "brace":
      return a.bracing.some(Boolean) ? "haul" : rest;
    case "waist":
      // Some hands are always at work about the deck (splicing, scrubbing, coiling down).
      return i % 4 === 0 ? "work" : a.handling.some(Boolean) && i % 4 === 1 ? "haul" : rest;
    default:
      return rest;
  }
};
