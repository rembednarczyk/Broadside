import { type DomainEvent } from "@broadside/core";
import { type Cue } from "@broadside/engine";

/**
 * Routes domain events to the views (Observer): sound cues and player notices. Pure mapping, so
 * it is tested without audio or DOM; the app hands the results to SynthAudio and the HUD.
 */
export const cueFor = (e: DomainEvent): Cue | null => {
  switch (e.type) {
    case "gunFired":
      return { kind: "gun", x: e.at.x, z: e.at.z, size: Math.sqrt(e.pounder / 12) };
    case "splash":
      return { kind: "splash", x: e.at.x, z: e.at.z, size: e.size };
    case "ricochet":
      return { kind: "splash", x: e.at.x, z: e.at.z, size: 0.5 };
    case "hit":
      return { kind: "wood", x: e.at.x, z: e.at.z, size: 1 };
    case "explosion":
      return { kind: "boom", x: e.at.x, z: e.at.z, size: Math.min(2, e.radius / 6) };
    case "magazineExploded":
      return { kind: "boom", x: e.at.x, z: e.at.z, size: 3 };
    case "lightning":
      return { kind: "boom", x: e.at.x, z: e.at.z, size: 2.5 };
    default:
      return null;
  }
};

/** Notice keys for events that concern the player's ship or its enemies. */
export const noticeFor = (e: DomainEvent, playerId: number): string | null => {
  switch (e.type) {
    case "mastFell":
      return e.ship === playerId ? "notice.mastFell" : null;
    case "fireStarted":
      return e.ship === playerId ? "notice.fire" : null;
    case "crewOverboard":
      return e.ship === playerId ? "notice.overboard" : null;
    case "crewRescued":
      return e.ship === playerId ? "notice.rescued" : null;
    case "shipSunk":
      return "notice.sunk";
    case "shipStruck":
      return "notice.struck";
    case "magazineExploded":
      return "notice.magazine";
    case "weatherChanged":
      return e.kind === "squall" ? "notice.squall" : e.kind === "spout" ? "notice.spout" : e.kind === "rogue" ? "notice.rogue" : null;
    default:
      return null;
  }
};
