import { type DomainEvent } from "@broadside/core";
import { type Cue } from "@broadside/engine";

/**
 * Routes domain events to the views (Observer): sound cues and player notices. Pure mapping, so
 * it is tested without audio or DOM (`playerId`: sounds of her own ship play only for the player's); the app hands the results to SynthAudio and the HUD.
 */
export const cueFor = (e: DomainEvent, playerId = -1): Cue | null => {
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
    case "collision":
      return { kind: "wood", x: e.at.x, z: e.at.z, size: Math.min(3, e.speed) };
    case "gold":
      return { kind: "coins" };
    case "boarded":
      return { kind: "clash" };
    case "contractDone":
    case "playerRescued":
      return { kind: "bell" };
    case "grounded":
      // Her own crew man the capstan to haul her off.
      return e.ship === playerId ? { kind: "capstan" } : null;
    case "contractAccepted":
      return { kind: "chest" };
    default:
      return null;
  }
};

/** Notice keys for events that concern the player's ship or its enemies. */
export const noticeFor = (e: DomainEvent, playerId: number): string | null => {
  switch (e.type) {
    case "mastFell":
      return e.ship === playerId ? "notice.mastFell" : null;
    case "reefed":
      return e.ship === playerId ? (e.up ? "notice.sailUp" : "notice.reefed") : null;
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
    case "boarded":
      if (e.by === playerId) return e.won ? "notice.boardWon" : "notice.boardLost";
      return e.ship === playerId ? "notice.boarded" : null;
    case "collision":
      return e.ram && (e.a === playerId || e.b === playerId) ? "notice.rammed" : null;
    case "standingChanged":
      return `notice.${e.hostile ? "war" : "peace"}.${e.faction}`;
    case "playerRescued":
      return "notice.captainRescued";
    case "contractAccepted":
      return "notice.contractAccepted";
    case "contractDone":
      return "notice.contractDone";
    case "contractFailed":
      return "notice.contractFailed";
    case "gold":
      return "notice.gold";
    case "tradeRefused":
      return "notice.tradeRefused";
    case "fortSilenced":
      return "notice.fortSilenced";
    case "fortCaptured":
      return e.by === playerId ? "notice.fortCaptured" : "notice.fortFell";
    case "assaultFailed":
      return e.by === playerId ? "notice.assaultFailed" : null;
    case "grounded":
      return e.ship === playerId ? "notice.grounded" : null;
    case "weatherChanged":
      return e.kind === "squall" ? "notice.squall" : e.kind === "spout" ? "notice.spout" : e.kind === "rogue" ? "notice.rogue" : null;
    default:
      return null;
  }
};
