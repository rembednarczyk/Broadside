import { type RigType } from "../sailing/aero";
import { type HullShape } from "../hull/hull-shape";

/**
 * Ship classes as data (Type Object pattern, "Game Programming Patterns", ch. 13): behaviour
 * lives in the systems, a class only describes a hull, a rig, guns and crew. Numbers are
 * coarsened from period vessels (cutter to third-rate ship of the line, 1700-1800).
 */
export type ShipClassId = "cutter" | "gunboat" | "sloop" | "schooner" | "brig" | "bomb" | "galleon" | "frigate" | "liner";

export interface SailDef {
  readonly rig: RigType;
  /** Area at full sail, square metres. */
  readonly area: number;
  /** Height of the centre of effort above the waterline. */
  readonly ceHeight: number;
  /** Studding sails can be set on square sails only: +25% area at the top sail level. */
  readonly studding: boolean;
}

export interface MastDef {
  /** Position along the hull (body z). */
  readonly z: number;
  readonly height: number;
  readonly sails: readonly SailDef[];
}

export type MountKind = "broadside" | "bowChaser" | "sternChaser" | "mortar" | "swivel";

export interface GunBattery {
  readonly kind: MountKind;
  /** Guns on each side for broadsides, total for the rest. */
  readonly count: number;
  /** Shot weight in pounds (4, 6, 9, 12, 18, 24, 32; mortars 100+). */
  readonly pounder: number;
  /** Height of the gun deck above the waterline. */
  readonly deckHeight: number;
}

export interface ShipClassDef {
  readonly id: ShipClassId;
  readonly hull: HullShape;
  readonly masts: readonly MastDef[];
  readonly guns: readonly GunBattery[];
  readonly crew: number;
  /** Cargo hold in tonnes (ammunition, stores, plunder). */
  readonly hold: number;
  /** Hit points of one hull section (there are six). */
  readonly sectionHp: number;
  readonly mastHp: number;
  readonly rudderArea: number;
  /** Centre of mass below the waterline as a share of the draft (ballast). */
  readonly ballast: number;
  /** Rowing thrust in newtons (galleys and gunboats only). */
  readonly oars: number;
  readonly price: number;
}

const hull = (length: number, beam: number, draft: number, freeboard: number, extra: Partial<HullShape> = {}): HullShape => ({
  length,
  beam,
  draft,
  freeboard,
  bowFineness: 2.2,
  sternFineness: 3.2,
  transom: 0.55,
  bilge: 2.4,
  sheer: freeboard * 0.35,
  ...extra,
});

const fa = (area: number, ceHeight: number): SailDef => ({ rig: "foreAft", area, ceHeight, studding: false });
const sq = (area: number, ceHeight: number): SailDef => ({ rig: "square", area, ceHeight, studding: true });

export const SHIP_CLASSES: Readonly<Record<ShipClassId, ShipClassDef>> = {
  cutter: {
    id: "cutter",
    hull: hull(14, 4.6, 1.9, 1.2, { bowFineness: 2.6, bilge: 1.8 }),
    masts: [{ z: 1.5, height: 15, sails: [fa(85, 6), fa(40, 5)] }],
    guns: [{ kind: "broadside", count: 3, pounder: 4, deckHeight: 1.3 }, { kind: "swivel", count: 2, pounder: 1, deckHeight: 1.6 }],
    crew: 24, hold: 20, sectionHp: 120, mastHp: 90, rudderArea: 1.6, ballast: 0.75, oars: 0, price: 1500,
  },
  gunboat: {
    id: "gunboat",
    hull: hull(16, 4.6, 1.2, 1.0, { transom: 0.5, bilge: 1.6 }),
    masts: [{ z: 2, height: 11, sails: [fa(70, 4.5)] }],
    guns: [{ kind: "bowChaser", count: 1, pounder: 24, deckHeight: 1.1 }, { kind: "swivel", count: 2, pounder: 1, deckHeight: 1.3 }],
    crew: 36, hold: 15, sectionHp: 110, mastHp: 70, rudderArea: 1.4, ballast: 0.5, oars: 14000, price: 1800,
  },
  sloop: {
    id: "sloop",
    hull: hull(22, 6.4, 2.6, 1.8),
    masts: [{ z: 2, height: 21, sails: [fa(170, 8), fa(85, 7), sq(55, 15)] }],
    guns: [{ kind: "broadside", count: 6, pounder: 6, deckHeight: 1.9 }, { kind: "bowChaser", count: 1, pounder: 6, deckHeight: 2 }, { kind: "swivel", count: 4, pounder: 1, deckHeight: 2.3 }],
    crew: 60, hold: 60, sectionHp: 220, mastHp: 160, rudderArea: 2.6, ballast: 0.7, oars: 0, price: 6000,
  },
  schooner: {
    id: "schooner",
    hull: hull(28, 7, 3, 2, { bowFineness: 2.5 }),
    masts: [{ z: 5, height: 24, sails: [fa(190, 9), fa(110, 8)] }, { z: -4, height: 26, sails: [fa(230, 10)] }],
    guns: [{ kind: "broadside", count: 5, pounder: 6, deckHeight: 2.1 }, { kind: "bowChaser", count: 1, pounder: 9, deckHeight: 2.2 }, { kind: "sternChaser", count: 1, pounder: 6, deckHeight: 2.2 }, { kind: "swivel", count: 4, pounder: 1, deckHeight: 2.5 }],
    crew: 70, hold: 90, sectionHp: 260, mastHp: 170, rudderArea: 3, ballast: 0.7, oars: 0, price: 9000,
  },
  brig: {
    id: "brig",
    hull: hull(32, 9, 3.8, 2.6),
    masts: [{ z: 6, height: 28, sails: [sq(340, 12), fa(110, 8)] }, { z: -4, height: 30, sails: [sq(360, 13), fa(130, 10)] }],
    guns: [{ kind: "broadside", count: 9, pounder: 12, deckHeight: 2.5 }, { kind: "bowChaser", count: 2, pounder: 9, deckHeight: 2.6 }, { kind: "sternChaser", count: 1, pounder: 9, deckHeight: 2.6 }, { kind: "swivel", count: 6, pounder: 1, deckHeight: 3 }],
    crew: 110, hold: 150, sectionHp: 380, mastHp: 240, rudderArea: 4, ballast: 0.72, oars: 0, price: 16000,
  },
  bomb: {
    id: "bomb",
    hull: hull(28, 9, 3.5, 2.3, { bowFineness: 1.8, bilge: 3 }),
    masts: [{ z: 3, height: 26, sails: [sq(330, 11), fa(90, 8)] }, { z: -7, height: 18, sails: [fa(140, 7)] }],
    guns: [{ kind: "mortar", count: 2, pounder: 130, deckHeight: 2.4 }, { kind: "broadside", count: 4, pounder: 6, deckHeight: 2.2 }, { kind: "swivel", count: 4, pounder: 1, deckHeight: 2.6 }],
    crew: 70, hold: 140, sectionHp: 400, mastHp: 220, rudderArea: 3.4, ballast: 0.8, oars: 0, price: 14000,
  },
  // A late galleon: short, deep and high-charged, with towering castles (the visual reference ship).
  galleon: {
    id: "galleon",
    hull: hull(35, 11, 4.4, 4.4, { bowFineness: 1.7, sternFineness: 2.2, transom: 0.8, bilge: 3, sheer: 4.6 }),
    masts: [
      { z: 9, height: 36, sails: [sq(430, 15), fa(120, 8)] },
      { z: -1, height: 41, sails: [sq(540, 17)] },
      { z: -10.5, height: 29, sails: [fa(150, 10), sq(150, 16)] },
    ],
    guns: [{ kind: "broadside", count: 14, pounder: 12, deckHeight: 2.8 }, { kind: "bowChaser", count: 2, pounder: 9, deckHeight: 3.6 }, { kind: "sternChaser", count: 2, pounder: 9, deckHeight: 4.6 }, { kind: "swivel", count: 8, pounder: 1, deckHeight: 4.5 }],
    crew: 220, hold: 320, sectionHp: 620, mastHp: 380, rudderArea: 6, ballast: 0.78, oars: 0, price: 32000,
  },
  frigate: {
    id: "frigate",
    hull: hull(45, 12, 5, 3.6),
    masts: [
      { z: 12, height: 40, sails: [sq(520, 17), fa(180, 10)] },
      { z: 0, height: 45, sails: [sq(600, 19)] },
      { z: -12, height: 34, sails: [sq(340, 14), fa(170, 9)] },
    ],
    guns: [{ kind: "broadside", count: 16, pounder: 18, deckHeight: 3.1 }, { kind: "bowChaser", count: 2, pounder: 9, deckHeight: 3.4 }, { kind: "sternChaser", count: 2, pounder: 9, deckHeight: 3.4 }, { kind: "swivel", count: 8, pounder: 1, deckHeight: 4.2 }],
    crew: 260, hold: 300, sectionHp: 700, mastHp: 420, rudderArea: 7, ballast: 0.72, oars: 0, price: 42000,
  },
  liner: {
    id: "liner",
    hull: hull(56, 15, 6.2, 5.6, { bowFineness: 2, bilge: 3, transom: 0.62 }),
    masts: [
      { z: 15, height: 48, sails: [sq(780, 20), fa(240, 12)] },
      { z: 1, height: 54, sails: [sq(860, 22)] },
      { z: -14, height: 42, sails: [sq(520, 17), fa(210, 11)] },
    ],
    guns: [{ kind: "broadside", count: 32, pounder: 24, deckHeight: 3.2 }, { kind: "bowChaser", count: 2, pounder: 12, deckHeight: 5 }, { kind: "sternChaser", count: 2, pounder: 12, deckHeight: 5 }, { kind: "swivel", count: 10, pounder: 1, deckHeight: 6 }],
    crew: 600, hold: 500, sectionHp: 1300, mastHp: 650, rudderArea: 10, ballast: 0.78, oars: 0, price: 110000,
  },
};

export const SHIP_CLASS_IDS = Object.keys(SHIP_CLASSES) as ShipClassId[];
