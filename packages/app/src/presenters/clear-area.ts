/**
 * The clear middle of the screen, between the HUD's regions as laid out now (screen fractions):
 * right of the left column, left of the right column, below the combat panel, above the bottom
 * row's pads and buttons. Measured from the page twice a second (the layout changes with the
 * screen, the language and the steering mode); a fixed guess put the enemy's arrow on the panels
 * (beta test 19.11). Falls back to the old guess without a page (tests).
 */
export interface Clear {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

const GUESS: Clear = { left: 0.24, right: 0.76, top: 0.2, bottom: 0.78 };
let cached: { at: number; clear: Clear } | null = null;

const rects = (selector: string): DOMRect[] => [...document.querySelectorAll(selector)].map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0);

export const clearArea = (now: number): Clear => {
  if (typeof document === "undefined") return GUESS;
  if (cached && now - cached.at < 500) return cached.clear;
  const w = window.innerWidth;
  const h = window.innerHeight;
  // Room for the arrow and its label (a word and a range, centred under it: about 90 x 34 px).
  const mx = 48;
  const my = 24;
  const left = Math.max(0, ...rects(".hud .col.left > *").map((r) => r.right + mx));
  const right = Math.min(w, ...rects(".hud .col.right > *").map((r) => r.left - mx));
  const top = Math.max(0, ...rects(".hud .combat").map((r) => r.bottom + my));
  const bottom = Math.min(h, ...rects(".hud .bottom > *").map((r) => r.top - my));
  // A degenerate middle (a very small screen): keep the old guess.
  const clear = right - left > w * 0.2 && bottom - top > h * 0.2 ? { left: left / w, right: right / w, top: top / h, bottom: bottom / h } : GUESS;
  cached = { at: now, clear };
  return clear;
};
