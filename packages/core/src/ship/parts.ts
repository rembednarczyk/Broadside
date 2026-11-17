/**
 * The parts of a ship, named (a part catalogue: the bill of materials of the generators). Every
 * part a generator or a view makes has a kind, a stable identifier built from its kind and its
 * place ("yard:1:2" is the third yard of the second mast, "shroud:0:port:3" the fourth port shroud
 * of the foremast), an anchor point in hull space and the part that carries it. With that a ship
 * can be checked by rule instead of by eye (`auditParts`): nothing hangs in the air, every shroud
 * has its channel, every gun its carriage, every mast is stayed on both sides, every sail has
 * its sheet and every yard its braces.
 *
 * The structure is a tree by `on` (Composite, GoF: parts carried by parts down to the hull).
 */
export const PART_KINDS = ["hull", "deck", "mast", "bowsprit", "top", "yard", "sail", "stay", "shroud", "channel", "rail", "gun", "carriage", "flag", "sheet", "brace", "castle", "lantern"] as const;
export type PartKind = (typeof PART_KINDS)[number];

export interface ShipPart {
  readonly id: string;
  readonly kind: PartKind;
  /** Anchor in hull space (metres: x to starboard, y up from the waterline, z forward). */
  readonly at: readonly [number, number, number];
  /** Identifier of the part that carries this one; null only for the hull. */
  readonly on: string | null;
}

/** Identifier of a part: its kind and its indices, joined by colons. */
export const partId = (kind: PartKind, ...place: readonly (string | number)[]): string => [kind, ...place].join(":");

/** What each kind of part may be carried by. */
export const CARRIERS: Readonly<Record<PartKind, readonly PartKind[]>> = {
  hull: [],
  deck: ["hull"],
  mast: ["hull"],
  bowsprit: ["hull"],
  top: ["mast"],
  yard: ["mast"],
  sail: ["yard", "mast", "stay", "bowsprit"],
  stay: ["mast"],
  shroud: ["channel"],
  channel: ["hull"],
  rail: ["hull"],
  gun: ["carriage", "rail"],
  carriage: ["deck"],
  flag: ["mast"],
  sheet: ["sail"],
  brace: ["yard"],
  castle: ["hull"],
  lantern: ["castle", "rail"],
};

export type PartFaultKind = "duplicate" | "orphan" | "wrongCarrier" | "outside" | "unstayed" | "noShrouds" | "noHull" | "noSheet" | "noBraces";

export interface PartFault {
  readonly fault: PartFaultKind;
  readonly part: string;
}

/** The box the parts of a ship must lie in. */
export interface PartBounds {
  readonly length: number;
  readonly beam: number;
  readonly draft: number;
  /** Height of the tallest mast above the waterline. */
  readonly height: number;
}

/**
 * Checks a ship's parts against the rules of the catalogue. Returns the faults (empty: sound).
 * - duplicate: two parts share an identifier;
 * - noHull: there is not exactly one hull;
 * - orphan: the carrier named does not exist (or a part other than the hull names none);
 * - wrongCarrier: the carrier is of a kind that cannot carry this part;
 * - outside: the anchor lies outside the ship (beyond the bowsprit's reach, off the beam, under
 *   the keel, above the mastheads);
 * - unstayed: a mast with no stay; noShrouds: a mast without shrouds on both sides;
 * - noSheet: a sail with no sheet to trim it; noBraces: a yard without a brace to each arm.
 */
export const auditParts = (parts: readonly ShipPart[], b: PartBounds): PartFault[] => {
  const faults: PartFault[] = [];
  const byId = new Map<string, ShipPart>();
  for (const p of parts) {
    if (byId.has(p.id)) faults.push({ fault: "duplicate", part: p.id });
    byId.set(p.id, p);
  }
  if (parts.filter((p) => p.kind === "hull").length !== 1) faults.push({ fault: "noHull", part: "hull" });
  for (const p of parts) {
    if (p.kind !== "hull") {
      const carrier = p.on === null ? undefined : byId.get(p.on);
      if (!carrier) faults.push({ fault: "orphan", part: p.id });
      else if (!CARRIERS[p.kind].includes(carrier.kind)) faults.push({ fault: "wrongCarrier", part: p.id });
    }
    const [x, y, z] = p.at;
    const inside = Math.abs(x) <= b.beam * 0.75 && y >= -b.draft - 0.01 && y <= b.height * 1.1 + 2 && z >= -b.length * 0.62 && z <= b.length * 0.95;
    if (!inside || ![x, y, z].every(Number.isFinite)) faults.push({ fault: "outside", part: p.id });
  }
  for (const m of parts.filter((p) => p.kind === "mast")) {
    if (!parts.some((p) => p.kind === "stay" && p.on === m.id)) faults.push({ fault: "unstayed", part: m.id });
    // Shrouds stand on channels; a channel is named after its mast and side.
    const sides = new Set(parts.filter((p) => p.kind === "channel" && p.id.startsWith(`${partId("channel", m.id.split(":")[1]!)}:`)).map((c) => (c.at[0] >= 0 ? "starboard" : "port")));
    const rigged = [...sides].filter((s) => parts.some((p) => p.kind === "shroud" && p.on === partId("channel", m.id.split(":")[1]!, s)));
    if (rigged.length < 2) faults.push({ fault: "noShrouds", part: m.id });
  }
  for (const s of parts.filter((p) => p.kind === "sail")) if (!parts.some((p) => p.kind === "sheet" && p.on === s.id)) faults.push({ fault: "noSheet", part: s.id });
  for (const y of parts.filter((p) => p.kind === "yard")) if (parts.filter((p) => p.kind === "brace" && p.on === y.id).length < 2 && !y.id.startsWith("yard:gaff")) faults.push({ fault: "noBraces", part: y.id });
  return faults;
};
