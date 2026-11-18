/**
 * Simple steering on the canvas: a tap gives an order by what it falls on (tap-targets: a place
 * to sail to, a ship to board or follow, a port, a fort, the own ship to stop); a drag draws a
 * course on the water that the ship follows and then holds. A tap is a press that hardly moves and
 * lets go quickly (the usual touch slop, about 10 px, and half a second); held longer without
 * moving it is a long press (a ship's menu of orders, or a waypoint added to the route); with
 * Shift a click adds a waypoint too. A second finger (a pinch, a twist) abandons the line.
 * Mouse: the left button only (the right one turns the view, FollowCamera.drawGestures).
 */
type P = { x: number; z: number };

export interface CourseTarget {
  /** Is simple steering on? */
  enabled(): boolean;
  /** The sea under a screen point (client pixels), or null. */
  pick(clientX: number, clientY: number): P | null;
  /** The line being drawn (empty: none). */
  showStroke(points: readonly P[]): void;
  /** A tap at a screen point (client pixels); `append`: add to the route instead of replacing it. */
  tap(clientX: number, clientY: number, append: boolean): void;
  /** A press held without moving. */
  longPress(clientX: number, clientY: number): void;
  /** A course drawn on the water, and where on screen it began and ended. */
  draw(route: readonly P[], from: { x: number; y: number }, to: { x: number; y: number }): void;
}

const TAP_SLOP = 10;
const TAP_TIME = 500;
/** A press held this long without moving is a long press (ms). */
export const LONG_PRESS = 550;
/** A drawn course keeps a point every this many metres, at most MAX_POINTS of them. */
export const COURSE_SPACING = 15;
export const MAX_POINTS = 24;

/** The drawn line thinned to points COURSE_SPACING apart (the last one kept), at most MAX_POINTS. */
export const thinCourse = (points: readonly P[]): P[] => {
  if (points.length === 0) return [];
  const out: P[] = [points[0]!];
  for (const p of points.slice(1)) if (Math.hypot(p.x - out[out.length - 1]!.x, p.z - out[out.length - 1]!.z) >= COURSE_SPACING) out.push(p);
  const end = points[points.length - 1]!;
  // The line ends where the finger lifted: the end replaces a kept point close before it.
  if (out[out.length - 1] !== end) {
    if (out.length > 1 && Math.hypot(end.x - out[out.length - 1]!.x, end.z - out[out.length - 1]!.z) < COURSE_SPACING * 0.3) out[out.length - 1] = end;
    else out.push(end);
  }
  if (out.length <= MAX_POINTS) return out;
  // Too long: keep an even selection, the ends included.
  return Array.from({ length: MAX_POINTS }, (_, i) => out[Math.round((i * (out.length - 1)) / (MAX_POINTS - 1))]!);
};

export const bindCourseGestures = (canvas: HTMLElement, t: CourseTarget): void => {
  const down = new Set<number>();
  let press: { id: number; x: number; y: number; at: number; drawing: boolean; line: P[] } | null = null;
  const end = (): void => {
    press = null;
    t.showStroke([]);
  };
  canvas.addEventListener("pointerdown", (e) => {
    down.add(e.pointerId);
    if (down.size > 1) return end();
    if (!t.enabled() || (e.pointerType === "mouse" && e.button !== 0)) return;
    const p = t.pick(e.clientX, e.clientY);
    press = { id: e.pointerId, x: e.clientX, y: e.clientY, at: e.timeStamp, drawing: false, line: p ? [p] : [] };
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!press || e.pointerId !== press.id) return;
    if (!press.drawing && Math.hypot(e.clientX - press.x, e.clientY - press.y) < TAP_SLOP) return;
    press.drawing = true;
    const p = t.pick(e.clientX, e.clientY);
    const last = press.line[press.line.length - 1];
    if (p && (!last || Math.hypot(p.x - last.x, p.z - last.z) > 2)) press.line.push(p);
    t.showStroke(press.line);
  });
  const up = (e: PointerEvent): void => {
    down.delete(e.pointerId);
    if (!press || e.pointerId !== press.id) return;
    const p = press;
    end();
    if (e.type === "pointercancel") return;
    if (!p.drawing) {
      const held = e.timeStamp - p.at;
      if (held >= LONG_PRESS) t.longPress(e.clientX, e.clientY);
      else if (held <= TAP_TIME) t.tap(e.clientX, e.clientY, e.shiftKey);
      return;
    }
    const route = thinCourse(p.line);
    if (route.length >= 2) t.draw(route, { x: p.x, y: p.y }, { x: e.clientX, y: e.clientY });
  };
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
};
