import { type DomainEvent } from "@broadside/core";
import { type Cue } from "@broadside/engine";

/**
 * Routes domain events to the views (Observer): sound cues and player notices. Pure mapping, so
 * it is tested without audio or DOM (`playerId`: sounds of her own ship play only for the player's); the app hands the results to SynthAudio and the HUD.
 */
/** `shipAt`: where a ship is (for events that name a ship but no place, such as a mast going by the board). */
export const cueFor = (e: DomainEvent, playerId = -1, shipAt: (id: number) => { x: number; z: number } | null = () => null): Cue | null => {
  switch (e.type) {
    case "gunFired":
      return { kind: "gun", x: e.at.x, z: e.at.z, size: Math.sqrt(e.pounder / 12) };
    case "splash":
      return { kind: "splash", x: e.at.x, z: e.at.z, size: e.size };
    case "ricochet":
      return { kind: "splash", x: e.at.x, z: e.at.z, size: 0.5 };
    case "hit":
      // A fort's stone cracks dull; on a ship, heavier blows crack louder (the heaviest as timbers stove in).
      if (e.part === "wall") return { kind: "stone", x: e.at.x, z: e.at.z, size: Math.min(2, 0.6 + e.damage / 20) };
      return { kind: "wood", x: e.at.x, z: e.at.z, size: Math.min(2, 0.6 + e.damage / 20) };
    case "mastFell": {
      const at = shipAt(e.ship);
      return at ? { kind: "mast", x: at.x, z: at.z } : null;
    }
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
    case "anchored": {
      // Letting go: the cable roars out and the anchor strikes the water; weighing: the capstan.
      if (e.ship !== playerId) return null;
      if (!e.down) return { kind: "capstan" };
      const at = shipAt(e.ship);
      return at ? { kind: "splash", x: at.x, z: at.z, size: 1.5 } : null;
    }
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
      return e.reason === "wreck" ? "notice.salvage" : "notice.gold";
    case "tradeRefused":
      return "notice.tradeRefused";
    case "fortSilenced":
      return "notice.fortSilenced";
    case "chainBarred":
      return e.ship === playerId ? "notice.chainBarred" : null;
    case "chainBroken":
      return "notice.chainBroken";
    case "furnaceOut":
      return "notice.furnaceOut";
    case "fortCaptured":
      return e.by === playerId ? "notice.fortCaptured" : "notice.fortFell";
    case "assaultFailed":
      return e.by === playerId ? "notice.assaultFailed" : null;
    case "grounded":
      return e.ship === playerId ? "notice.grounded" : null;
    case "anchored":
      return e.ship === playerId && e.down ? "notice.anchored" : null;
    case "ammoOut":
      return e.ship === playerId ? "notice.ammoOut" : null;
    case "weatherChanged":
      return e.kind === "squall" ? "notice.squall" : e.kind === "spout" ? "notice.spout" : e.kind === "rogue" ? "notice.rogue" : e.kind === "gale" ? "notice.gale" : e.kind === "storm" ? "notice.storm" : null;
    default:
      return null;
  }
};
