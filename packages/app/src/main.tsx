import { createRoot } from "react-dom/client";
import { BabylonRenderer } from "@broadside/engine";
import { Hud, type UiIntents, patchHud, useHud } from "@broadside/ui";
import { GameSession } from "./game-session";
import { presentSailing } from "./presenters/sailing-presenter";
import { bindKeyboard } from "./controllers/keyboard";
import "./style.css";

/** Composition root (ADR-0001): wires session, renderer, HUD and input. */
const params = new URLSearchParams(location.search);
const seed = Number(params.get("seed") ?? 1797);
const touch = matchMedia("(pointer: coarse)").matches;
const canvas = document.getElementById("game") as HTMLCanvasElement;
const session = new GameSession({ seed });
const renderer = new BabylonRenderer({ canvas, renderScale: touch ? 0.7 : 1, quality: params.get("quality") === "low" ? "low" : "high" });

const intents: UiIntents = {
  helm: { steer: (d) => session.steer(d) },
  sails: { setSails: (l) => session.setSails(l), toggleOars: () => session.toggleOars() },
  settings: { setLanguage: (language) => patchHud({ language }) },
};
createRoot(document.getElementById("hud")!).render(<Hud intents={intents} />);
bindKeyboard(window, intents, () => useHud.getState().sailing?.sailTargets[0] ?? 3);
addEventListener("resize", () => renderer.resize());

let last = performance.now();
let fpsAcc = 0;
let frames = 0;
const hours = Number(params.get("hours") ?? 16.5);
const frame = (now: number) => {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  session.advance(dt);
  renderer.frame(session.sim, { hours, overcast: Number(params.get("overcast") ?? 0.15), fog: 0 }, dt);
  fpsAcc += dt;
  frames++;
  if (fpsAcc > 0.5) {
    patchHud({ sailing: presentSailing(session.sim, session.playerId), fps: frames / fpsAcc, drawCalls: renderer.drawCalls() });
    fpsAcc = 0;
    frames = 0;
  } else patchHud({ sailing: presentSailing(session.sim, session.playerId) });
  requestAnimationFrame(frame);
};
requestAnimationFrame(frame);
(globalThis as unknown as { __broadside: unknown }).__broadside = { session, renderer };
