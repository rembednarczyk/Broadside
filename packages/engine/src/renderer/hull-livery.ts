import { type HullShape, createRng, hashString, range } from "@broadside/core";

/**
 * Hull paint as a list of drawing operations in texture space (u along the hull from stern to bow,
 * v up from the keel), generated deterministically from the class and faction (a seeded
 * generator, so the same ship always looks the same). The engine replays them on a canvas;
 * tests check them without one (Command pattern for drawing, like a display list).
 */
export type PaintOp =
  | { readonly op: "rect"; readonly u0: number; readonly v0: number; readonly u1: number; readonly v1: number; readonly color: string }
  | { readonly op: "hline"; readonly v: number; readonly width: number; readonly color: string };

export interface LiveryInput {
  readonly hull: HullShape;
  /** Gun-deck height above the waterline and broadside gun positions along the hull (body z). */
  readonly gunDeck: number;
  readonly gunZ: readonly number[];
  readonly stripe: readonly [number, number, number];
  readonly seed: string;
}

/** Bulwark height above the deck, shared with the hull geometry. */
export const BULWARK = 0.9;

const css = (c: readonly [number, number, number], k = 1): string => `rgb(${Math.round(c[0] * 255 * k)},${Math.round(c[1] * 255 * k)},${Math.round(c[2] * 255 * k)})`;

export const hullHeight = (h: HullShape): number => h.draft + h.freeboard + h.sheer + BULWARK;

export const liveryOps = (input: LiveryInput): PaintOp[] => {
  const h = input.hull;
  const H = hullHeight(h);
  const v = (y: number): number => (y + h.draft) / H;
  const rng = createRng(hashString(input.seed));
  const ops: PaintOp[] = [];
  // Topsides: planks of slightly varying tone.
  ops.push({ op: "rect", u0: 0, v0: v(0), u1: 1, v1: 1, color: "rgb(122,88,54)" });
  for (let y = 0.2; y < h.freeboard + h.sheer + BULWARK; y += 0.32) {
    const k = range(rng, 0.85, 1.1);
    ops.push({ op: "rect", u0: 0, v0: v(y), u1: 1, v1: v(y + 0.3), color: css([0.48, 0.35, 0.22], k) });
    ops.push({ op: "hline", v: v(y), width: 1, color: "rgba(30,20,12,0.6)" });
  }
  // Below the waterline: copper sheathing with plate seams.
  ops.push({ op: "rect", u0: 0, v0: 0, u1: 1, v1: v(0.12), color: "rgb(150,86,52)" });
  for (let y = -h.draft; y < 0.1; y += 0.45) ops.push({ op: "hline", v: v(y), width: 1, color: "rgba(80,40,20,0.5)" });
  // Black wale and the livery band along the gun deck.
  ops.push({ op: "rect", u0: 0, v0: v(0.12), u1: 1, v1: v(0.6), color: "rgb(28,22,18)" });
  const band = 0.95;
  ops.push({ op: "rect", u0: 0, v0: v(input.gunDeck - band / 2), u1: 1, v1: v(input.gunDeck + band / 2), color: css(input.stripe) });
  ops.push({ op: "rect", u0: 0, v0: v(input.gunDeck + band / 2), u1: 1, v1: v(input.gunDeck + band / 2 + 0.12), color: "rgb(20,16,14)" });
  // Gun ports: dark squares with a lid frame, at the broadside guns.
  for (const z of input.gunZ) {
    const u = z / h.length + 0.5;
    const w = 0.7 / h.length;
    ops.push({ op: "rect", u0: u - w, v0: v(input.gunDeck - 0.32), u1: u + w, v1: v(input.gunDeck + 0.32), color: "rgb(14,10,8)" });
  }
  // Cap rail.
  ops.push({ op: "rect", u0: 0, v0: 0.985, u1: 1, v1: 1, color: "rgb(40,30,22)" });
  return ops;
};

/** Minimal 2D context surface the painter needs (a real canvas or a test double). */
export interface PaintTarget {
  fillStyle: string | CanvasGradient | CanvasPattern;
  fillRect(x: number, y: number, w: number, h: number): void;
}

/** Replays the ops; canvas y grows down, texture v grows up. */
export const paint = (ctx: PaintTarget, ops: readonly PaintOp[], width: number, height: number): void => {
  for (const o of ops) {
    ctx.fillStyle = o.color;
    if (o.op === "rect") ctx.fillRect(o.u0 * width, (1 - o.v1) * height, (o.u1 - o.u0) * width, (o.v1 - o.v0) * height);
    else ctx.fillRect(0, (1 - o.v) * height - o.width / 2, width, o.width);
  }
};
