/**
 * A tap on a ship marks her as the target in the steering modes whose canvas has no gestures of
 * its own (helm, action, fun; simple steering's taps go through course-gestures, which marks too).
 * A tap is a press released within TAP_MS and TAP_PX of where it began (a drag turns the camera).
 */
const TAP_MS = 350;
const TAP_PX = 12;

export const bindTargetTaps = (canvas: HTMLElement, t: { enabled(): boolean; shipAt(x: number, y: number): number | null; mark(id: number): void }): void => {
  let down: { x: number; y: number; at: number; id: number } | null = null;
  canvas.addEventListener("pointerdown", (e) => {
    down = t.enabled() && e.isPrimary ? { x: e.clientX, y: e.clientY, at: e.timeStamp, id: e.pointerId } : null;
  });
  canvas.addEventListener("pointerup", (e) => {
    const d = down;
    down = null;
    if (!d || d.id !== e.pointerId || e.timeStamp - d.at > TAP_MS || Math.hypot(e.clientX - d.x, e.clientY - d.y) > TAP_PX) return;
    const ship = t.shipAt(e.clientX, e.clientY);
    if (ship !== null) t.mark(ship);
  });
};
