/**
 * What a tap on the sea means (pure, tested): the nearest thing under the finger within its
 * reach on screen (a ship, a port's approach, a fort, the player's own ship), else the water;
 * and the order that follows from it. A context-sensitive command (as in real-time strategy
 * games: the same tap moves to open ground and attacks an enemy): an enemy ship is run down and
 * boarded, any other ship followed, a port put into, a fort closed and stormed, the own ship
 * stopped, open water sailed to.
 */
type P = { x: number; z: number };

export interface Tappable {
  readonly kind: "self" | "ship" | "port" | "fort";
  readonly id: number;
  /** Where it is on screen (client pixels) and how far round it a tap still finds it. */
  readonly sx: number;
  readonly sy: number;
  readonly reach: number;
  /** Where it is on the sea (a port: its approach). */
  readonly at: P;
  /** A ship of a nation the player is at war with (or a pirate). */
  readonly hostile?: boolean;
}

export type TapOrder =
  | { readonly kind: "stop"; readonly at: P }
  | { readonly kind: "go"; readonly at: P }
  | { readonly kind: "dock"; readonly at: P }
  | { readonly kind: "board" | "follow"; readonly target: number; readonly at: P }
  | { readonly kind: "storm"; readonly fort: number; readonly at: P };

/** The nearest thing within reach of the tap, or null (open water). */
export const tappedAt = (x: number, y: number, items: readonly Tappable[]): Tappable | null => {
  let best: Tappable | null = null;
  let bestD = Infinity;
  for (const it of items) {
    const d = Math.hypot(it.sx - x, it.sy - y);
    if (d <= it.reach && d / it.reach < bestD) {
      best = it;
      bestD = d / it.reach;
    }
  }
  return best;
};

/** The order a tap gives: by what was tapped, else sail to the water point (null: above the horizon). */
export const orderFor = (hit: Tappable | null, water: P | null): TapOrder | null => {
  if (!hit) return water ? { kind: "go", at: water } : null;
  switch (hit.kind) {
    case "self":
      return { kind: "stop", at: hit.at };
    case "ship":
      return { kind: hit.hostile ? "board" : "follow", target: hit.id, at: hit.at };
    case "port":
      return { kind: "dock", at: hit.at };
    case "fort":
      return { kind: "storm", fort: hit.id, at: hit.at };
  }
};
