import { type UiIntents } from "@broadside/ui";

/**
 * Keyboard bindings onto the same intents the touch HUD raises (one input path, two devices).
 * A/D or arrows steer while held, W/S raise and lower sail, R toggles the oars.
 */
export const bindKeyboard = (target: Window, intents: UiIntents, currentSail: () => number): (() => void) => {
  const held = new Set<string>();
  const steer = () => intents.helm.steer(held.has("left") && !held.has("right") ? -1 : held.has("right") && !held.has("left") ? 1 : 0);
  const key = (code: string): string | null => {
    if (code === "KeyA" || code === "ArrowLeft") return "left";
    if (code === "KeyD" || code === "ArrowRight") return "right";
    return null;
  };
  const down = (e: KeyboardEvent) => {
    const k = key(e.code);
    if (k && !held.has(k)) {
      held.add(k);
      steer();
    }
    if (e.repeat) return;
    if (e.code === "KeyW" || e.code === "ArrowUp") intents.sails.setSails(Math.min(4, currentSail() + 1));
    if (e.code === "KeyS" || e.code === "ArrowDown") intents.sails.setSails(Math.max(0, currentSail() - 1));
    if (e.code === "KeyR") intents.sails.toggleOars();
  };
  const up = (e: KeyboardEvent) => {
    const k = key(e.code);
    if (k) {
      held.delete(k);
      steer();
    }
  };
  target.addEventListener("keydown", down);
  target.addEventListener("keyup", up);
  return () => {
    target.removeEventListener("keydown", down);
    target.removeEventListener("keyup", up);
  };
};
