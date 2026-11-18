/**
 * Two-finger twist to turn the view (the map gesture of phones): the change of the angle of the
 * line between two touches, frame to frame, turns the orbit by the same angle. Pure angle maths
 * (tested) and a binding to the canvas's pointer events; the pinch to zoom stays Babylon's.
 */
type Pt = { x: number; y: number };

/** Signed change (radians, wrapped to -PI..PI) of the direction from a to b between two moments. */
export const twistDelta = (a0: Pt, b0: Pt, a1: Pt, b1: Pt): number => {
  const d = Math.atan2(b1.y - a1.y, b1.x - a1.x) - Math.atan2(b0.y - a0.y, b0.x - a0.x);
  return Math.atan2(Math.sin(d), Math.cos(d));
};

/** Calls `turn(radians)` as two touches twist on the element. */
export const bindTwist = (el: HTMLElement, turn: (radians: number) => void): void => {
  const touches = new Map<number, Pt>();
  el.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "touch") touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  });
  el.addEventListener("pointermove", (e) => {
    const prev = touches.get(e.pointerId);
    if (!prev) return;
    const next = { x: e.clientX, y: e.clientY };
    if (touches.size === 2) {
      const [other] = [...touches.entries()].filter(([id]) => id !== e.pointerId).map(([, p]) => p);
      if (other) turn(twistDelta(prev, other, next, other));
    }
    touches.set(e.pointerId, next);
  });
  const up = (e: PointerEvent): void => {
    touches.delete(e.pointerId);
  };
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", up);
};
