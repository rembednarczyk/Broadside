/**
 * Where to draw the arrow towards an enemy the player cannot see: the HUD panels own the corners
 * and the top, so anything outside the clear middle of the screen counts as hidden. The arrow sits
 * where the line from the screen centre to the enemy leaves that clear rectangle (Presenter).
 */
const CLEAR = { left: 0.24, right: 0.76, top: 0.2, bottom: 0.78 } as const;

/** `clear`: the clear middle of the screen (fractions; presenters/clear-area measures the HUD), by default a fixed guess. */
export const presentMarker = (screen: { x: number; y: number }, range: number, c: { left: number; right: number; top: number; bottom: number } = CLEAR): { x: number; y: number; angle: number; range: number } | null => {
  const inside = screen.x > c.left && screen.x < c.right && screen.y > c.top && screen.y < c.bottom;
  if (inside) return null;
  const dx = screen.x - 0.5;
  const dy = screen.y - 0.5;
  const sx = dx === 0 ? Infinity : (dx > 0 ? c.right - 0.5 : c.left - 0.5) / dx;
  const sy = dy === 0 ? Infinity : (dy > 0 ? c.bottom - 0.5 : c.top - 0.5) / dy;
  const s = Math.min(sx, sy);
  // The arrow glyph points up: rotate it towards the enemy (screen y grows downwards).
  return { x: 0.5 + dx * s, y: 0.5 + dy * s, angle: Math.atan2(dx, -dy), range };
};

type Marker = { x: number; y: number; angle: number; range: number };

/**
 * The arrow towards the ship of the contract in hand when she is out of view (a quarry to hunt or a
 * merchantman to escort, often well out of sight: the beta testers lost her), with what a tap on
 * it orders (follow her for an escort, fight her otherwise).
 */
export const jobMarker = (
  job: { readonly target: number; readonly kind: string } | null,
  target: { readonly x: number; readonly z: number } | null,
  me: { readonly x: number; readonly z: number },
  project: (x: number, z: number) => { x: number; y: number },
  clear: { left: number; right: number; top: number; bottom: number },
): (Marker & { kind: "job"; target: number; order: "follow" | "engage" }) | null => {
  if (!job || !target) return null;
  const m = presentMarker(project(target.x, target.z), Math.hypot(target.x - me.x, target.z - me.z), clear);
  return m ? { ...m, kind: "job", target: job.target, order: job.kind === "escort" ? "follow" : "engage" } : null;
};

