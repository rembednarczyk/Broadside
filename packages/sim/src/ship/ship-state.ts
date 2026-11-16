import { type AmmoId, type MountKind, type SailLevel } from "@broadside/core";
import { type ShipModel } from "./ship-model";

/**
 * Mutable state of one ship while sailing (a component of the ship entity). Hot-path numbers are
 * mutated in place by the systems (ADR-0002, as in SpinalTap ADR-0002).
 */
export type FactionId = "player" | "crown" | "republic" | "empire" | "pirates";

/** Hull sections: index = zone * 2 + side; zones bow 0, waist 1, stern 2; sides port 0, starboard 1. */
export const SECTION_COUNT = 6;
export const sectionIndex = (zone: 0 | 1 | 2, starboard: boolean): number => zone * 2 + (starboard ? 1 : 0);

export interface SectionState {
  hp: number;
  /** Water coming in through shot holes below the waterline, m^3/s. */
  leak: number;
  /** Water inside the section, m^3. */
  water: number;
  /** Fire intensity 0..1 (0 = no fire). */
  fire: number;
}

export interface GunState {
  /** Seconds until loaded; 0 means ready. */
  reload: number;
  ammo: AmmoId;
  dismounted: boolean;
  /** Seconds until this gun fires as part of a ripple broadside (-1 = not queued). */
  fuse: number;
  /** Elevation chosen when the gun was queued. */
  elevation: number;
}

export interface ShipState {
  readonly model: ShipModel;
  faction: FactionId;
  rudder: number;
  rudderTarget: number;
  /** Heading the helmsman holds, or null when the rudder is commanded directly. */
  course: number | null;
  /** Integral of the heading error (helmsman's PID), clamped against windup. */
  courseIntegral: number;
  sailTarget: SailLevel[];
  /** Share of full sail actually set on each mast (0..1.25). */
  sailSet: number[];
  /** Sail cloth condition per mast (holes): 0..1. */
  sailCloth: number[];
  mastHp: number[];
  /** Standing and running rigging condition 0..1: slows sail handling and trim. */
  rigging: number;
  sections: SectionState[];
  crew: number;
  guns: GunState[];
  ammoLoad: Partial<Record<MountKind, AmmoId>>;
  /** Gun loads in the hold per ammunition kind. */
  stores: Partial<Record<AmmoId, number>>;
  braced: number;
  oars: boolean;
  sinking: boolean;
  /** Seconds since the ship went under (removal after a while). */
  sunkFor: number;
  lastHitBy: number | null;
  struck: boolean;
}

export const setFactor = (level: SailLevel, studding: boolean): number => [0, 0.35, 0.65, 1, studding ? 1.25 : 1][level] ?? 0;

const defaultAmmo: Partial<Record<MountKind, AmmoId>> = { broadside: "round", bowChaser: "round", sternChaser: "round", mortar: "shell", swivel: "grape" };

export const createShipState = (model: ShipModel, faction: FactionId, sail: SailLevel = 3): ShipState => {
  const def = model.def;
  return {
    model,
    faction,
    rudder: 0,
    rudderTarget: 0,
    course: null,
    courseIntegral: 0,
    sailTarget: def.masts.map(() => sail),
    sailSet: def.masts.map(() => setFactor(sail, false)),
    sailCloth: def.masts.map(() => 1),
    mastHp: def.masts.map(() => def.mastHp),
    rigging: 1,
    sections: Array.from({ length: SECTION_COUNT }, () => ({ hp: def.sectionHp, leak: 0, water: 0, fire: 0 })),
    crew: def.crew,
    guns: model.guns.map((g) => ({ reload: 0, ammo: defaultAmmo[g.kind] ?? "round", dismounted: false, fuse: -1, elevation: 0 })),
    ammoLoad: { ...defaultAmmo },
    stores: { round: 40 * def.guns.length, chain: 12, grape: 12, heavy: 8, hot: 4, shell: def.guns.some((g) => g.kind === "mortar") ? 30 : 0, fireBarrel: 3, mine: 2 },
    braced: 0,
    oars: false,
    sinking: false,
    sunkFor: 0,
    lastHitBy: null,
    struck: false,
  };
};

export const crewShare = (s: ShipState): number => s.crew / s.model.def.crew;
