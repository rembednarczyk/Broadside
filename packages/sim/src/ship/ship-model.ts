import {
  type HullModel,
  type HullSample,
  type MountKind,
  type ShipClassDef,
  type ShipClassId,
  type Vec3,
  SHIP_CLASSES,
  WATER_DENSITY,
  buildHullModel,
  sub,
  vec3,
} from "@broadside/core";

/**
 * Everything about a ship class that does not change while sailing, computed once per class and
 * shared by all ships of the class (Flyweight, GoF). Mass follows from the hull: a ship floats at
 * its design waterline by construction, so no hand-tuned masses drift out of step with the lines.
 */
export interface GunMount {
  readonly kind: MountKind;
  /** Body space, relative to the centre of mass. */
  readonly pos: Vec3;
  /** Body-space unit direction the muzzle points (before elevation). */
  readonly dir: Vec3;
  readonly pounder: number;
  readonly side: "port" | "starboard" | "centre";
}

export interface SailModel {
  readonly ce: Vec3;
  readonly area: number;
  readonly rig: "square" | "foreAft";
  readonly studding: boolean;
}

export interface MastModel {
  /** Body space relative to the centre of mass, at the deck. */
  readonly base: Vec3;
  readonly height: number;
  readonly sails: readonly SailModel[];
  /** Sail force the mast stands without damage (newtons). */
  readonly strength: number;
}

export interface ShipModel {
  readonly def: ShipClassDef;
  readonly hull: HullModel;
  /** Hull samples relative to the centre of mass. */
  readonly samples: readonly HullSample[];
  readonly mass: number;
  readonly inertia: Vec3;
  /** Centre of mass in hull space (origin at the waterline, midships). */
  readonly com: Vec3;
  readonly masts: readonly MastModel[];
  readonly guns: readonly GunMount[];
  /** Rudder hinge relative to the centre of mass. */
  readonly rudder: Vec3;
}

/** Sail pressure a mast stands at full sail (Pa): full sail is safe to about Beaufort 7, the period practice of reefing topsails in a strong breeze. */
const MAST_PRESSURE = 150;

const broadside = (def: ShipClassDef, count: number, pounder: number, deck: number, com: Vec3): GunMount[] => {
  const h = def.hull;
  const out: GunMount[] = [];
  for (let i = 0; i < count; i++) {
    const z = h.length * (-0.32 + (0.64 * (i + 0.5)) / count);
    for (const side of ["port", "starboard"] as const) {
      const sx = side === "starboard" ? 1 : -1;
      out.push({ kind: "broadside", pos: sub(vec3((sx * h.beam) / 2, deck, z), com), dir: vec3(sx, 0, 0), pounder, side });
    }
  }
  return out;
};

const centreMount = (def: ShipClassDef, kind: MountKind, i: number, count: number, pounder: number, deck: number, com: Vec3): GunMount => {
  const h = def.hull;
  const spread = count > 1 ? (i / (count - 1) - 0.5) * h.beam * 0.4 : 0;
  if (kind === "bowChaser") return { kind, pos: sub(vec3(spread, deck, h.length * 0.46), com), dir: vec3(0, 0, 1), pounder, side: "centre" };
  if (kind === "sternChaser") return { kind, pos: sub(vec3(spread, deck, -h.length * 0.48), com), dir: vec3(0, 0, -1), pounder, side: "centre" };
  if (kind === "mortar") return { kind, pos: sub(vec3(0, deck, h.length * (0.18 - i * 0.14)), com), dir: vec3(0, 0, 1), pounder, side: "centre" };
  // Swivels alternate sides along the rail.
  const side = i % 2 === 0 ? "starboard" : "port";
  const pairs = Math.max(1, Math.ceil(count / 2) - 1);
  const z = h.length * (0.32 - (0.64 * Math.floor(i / 2)) / pairs);
  const sx = side === "starboard" ? 1 : -1;
  return { kind, pos: sub(vec3(sx * h.beam * 0.45, deck, z), com), dir: vec3(sx, 0, 0), pounder, side };
};

const mounts = (def: ShipClassDef, com: Vec3): GunMount[] =>
  def.guns.flatMap((g) =>
    g.kind === "broadside"
      ? broadside(def, g.count, g.pounder, g.deckHeight, com)
      : Array.from({ length: g.count }, (_, i) => centreMount(def, g.kind, i, g.count, g.pounder, g.deckHeight, com)),
  );

const build = (def: ShipClassDef): ShipModel => {
  const hull = buildHullModel(def.hull);
  const h = def.hull;
  const mass = hull.designVolume * WATER_DENSITY;
  // Ballast puts the centre of mass below the waterline.
  const com = vec3(0, -h.draft * def.ballast * 0.5, 0);
  // Radii of gyration of displacement ships: roll ~0.4 B, pitch and yaw ~0.25 L (ITTC 7.5-02-07-04).
  const kRoll = 0.4 * h.beam;
  const kPitch = 0.25 * h.length;
  const inertia = vec3(mass * kPitch * kPitch, mass * kPitch * kPitch, mass * kRoll * kRoll);
  const samples = hull.samples.map((s) => ({ ...s, p: sub(s.p, com) }));
  const masts: MastModel[] = def.masts.map((m) => {
    const area = m.sails.reduce((a, s) => a + s.area, 0);
    return {
      base: sub(vec3(0, h.freeboard, m.z), com),
      height: m.height,
      sails: m.sails.map((s) => ({ ce: sub(vec3(0, s.ceHeight, m.z), com), area: s.area, rig: s.rig, studding: s.studding })),
      strength: area * MAST_PRESSURE * 1.6,
    };
  });
  return { def, hull, samples, mass, inertia, com, masts, guns: mounts(def, com), rudder: sub(vec3(0, -h.draft * 0.5, -h.length * 0.5), com) };
};

const cache = new Map<ShipClassId, ShipModel>();

export const shipModel = (id: ShipClassId): ShipModel => {
  let m = cache.get(id);
  if (!m) {
    m = build(SHIP_CLASSES[id]);
    cache.set(id, m);
  }
  return m;
};
