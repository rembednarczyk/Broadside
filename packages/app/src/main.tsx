import { createRoot } from "react-dom/client";
import { BabylonRenderer, SynthAudio } from "@broadside/engine";
import { Hud, type UiIntents, patchHud, useHud } from "@broadside/ui";
import { GameSession } from "./game-session";
import { presentSailing } from "./presenters/sailing-presenter";
import { presentCombat, presentTarget } from "./presenters/combat-presenter";
import { cueFor, noticeFor } from "./presenters/event-presenter";
import { type AmmoId } from "@broadside/core";
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
  combat: {
    fire: (mount, side) => session.fire(mount, side),
    loadAmmo: (ammo) => session.loadAmmo(ammo as AmmoId),
    brace: () => session.brace(),
    drop: (kind) => session.drop(kind),
  },
  settings: { setLanguage: (language) => patchHud({ language }) },
};
createRoot(document.getElementById("hud")!).render(<Hud intents={intents} />);
bindKeyboard(window, intents, () => useHud.getState().sailing?.sailTargets[0] ?? 3);
addEventListener("resize", () => renderer.resize());
const audio = new SynthAudio();
addEventListener("pointerdown", () => audio.unlock());
addEventListener("keydown", () => audio.unlock());
let noticeId = 0;
const pushNotice = (key: string) => {
  const id = ++noticeId;
  patchHud({ notices: [...useHud.getState().notices.slice(-3), { id, key }] });
  setTimeout(() => patchHud({ notices: useHud.getState().notices.filter((n) => n.id !== id) }), 3500);
};

let last = performance.now();
let fpsAcc = 0;
let frames = 0;
const hours = Number(params.get("hours") ?? 16.3);
const frame = (now: number) => {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  session.advance(dt);
  const events = session.sim.drainEvents();
  renderer.onEvents(events);
  const listener = { x: renderer.camera.camera.target.x, z: renderer.camera.camera.target.z, heading: renderer.camera.viewHeading() };
  for (const e of events) {
    const cue = cueFor(e);
    if (cue) audio.play(cue, listener);
    const n = noticeFor(e, session.playerId);
    if (n) pushNotice(n);
  }
  audio.setWeather(session.sim.env.windSpeed, 0.5);
  renderer.frame(session.sim, { hours, overcast: Number(params.get("overcast") ?? 0.55), fog: 0 }, dt);
  fpsAcc += dt;
  frames++;
  if (fpsAcc > 0.5) {
    patchHud({ fps: frames / fpsAcc, drawCalls: renderer.drawCalls() });
    fpsAcc = 0;
    frames = 0;
  }
  const me = session.sim.byId(session.playerId);
  patchHud({ sailing: presentSailing(session.sim, session.playerId), combat: me ? presentCombat(me) : null, target: me?.body ? presentTarget(session.sim, me) : null });
  requestAnimationFrame(frame);
};
requestAnimationFrame(frame);
(globalThis as unknown as { __broadside: unknown }).__broadside = { session, renderer };
