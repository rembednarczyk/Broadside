import { createRoot } from "react-dom/client";
import { CAMERA_MODES, BabylonRenderer, type GraphicsPreset, type GraphicsSettings, SynthAudio, parseGraphics, presetSettings, withSetting } from "@broadside/engine";
import { Hud, type UiIntents, patchHud, useHud } from "@broadside/ui";
import { GameSession } from "./game-session";
import { presentSailing } from "./presenters/sailing-presenter";
import { presentCombat, presentTarget } from "./presenters/combat-presenter";
import { cueFor, noticeFor } from "./presenters/event-presenter";
import { type AmmoId, type WeatherKind, WEATHER } from "@broadside/core";
import { bindKeyboard } from "./controllers/keyboard";
import "./style.css";

/** Composition root (ADR-0001): wires session, renderer, HUD and input. */
const params = new URLSearchParams(location.search);
const seed = Number(params.get("seed") ?? 1797);
const touch = matchMedia("(pointer: coarse)").matches;
const canvas = document.getElementById("game") as HTMLCanvasElement;
const weatherParam = params.get("weather");
const weather = weatherParam && weatherParam in WEATHER ? (weatherParam as WeatherKind) : "fresh";
const session = new GameSession({ seed, weather });
// Graphics settings: stored on this device (a per-viewer convenience), a URL preset overrides.
const GFX_KEY = "broadside.graphics";
const readStored = (): string | null => {
  try {
    return localStorage.getItem(GFX_KEY);
  } catch {
    return null;
  }
};
const urlPreset = params.get("quality");
let graphics: GraphicsSettings = urlPreset && ["low", "medium", "high", "ultra", "cinematic"].includes(urlPreset) ? presetSettings(urlPreset as GraphicsPreset) : parseGraphics(readStored(), touch);
let renderer = new BabylonRenderer({ canvas, graphics });
const applyGraphics = (next: GraphicsSettings) => {
  graphics = next;
  try {
    localStorage.setItem(GFX_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable: the choice lasts for this run only.
  }
  renderer.dispose();
  renderer = new BabylonRenderer({ canvas, graphics });
  patchHud({ graphics: { preset: next.preset, renderScale: next.renderScale } });
};
patchHud({ graphics: { preset: graphics.preset, renderScale: graphics.renderScale } });

const intents: UiIntents = {
  helm: { steer: (d) => session.steer(d) },
  sails: { setSails: (l) => session.setSails(l), setMastSails: (m, l) => session.setMastSails(m, l), toggleOars: () => session.toggleOars() },
  combat: {
    fire: (mount, side) => session.fire(mount, side),
    loadAmmo: (ammo) => session.loadAmmo(ammo as AmmoId),
    brace: () => session.brace(),
    drop: (kind) => session.drop(kind),
  },
  settings: {
    setLanguage: (language) => patchHud({ language }),
    setGraphicsPreset: (p) => applyGraphics(presetSettings(p as GraphicsPreset)),
    setRenderScale: (scale) => applyGraphics(withSetting(graphics, "renderScale", scale)),
    toggleSettings: () => patchHud({ settingsOpen: !useHud.getState().settingsOpen }),
    toggleHud: () => patchHud({ hudHidden: !useHud.getState().hudHidden }),
    nextCamera: () => {
      const next = CAMERA_MODES[(CAMERA_MODES.indexOf(renderer.camera.mode) + 1) % CAMERA_MODES.length]!;
      renderer.camera.mode = next;
      patchHud({ cameraMode: next });
    },
  },
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
// One game hour passes in four minutes (a day in an hour and a half).
const startHours = Number(params.get("hours") ?? 16.3);
const hoursNow = () => (startHours + session.sim.env.time / 240) % 24;
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
  renderer.frame(session.sim, { hours: hoursNow(), overcast: Number(params.get("overcast") ?? 0.55), fog: 0 }, dt);
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
Object.defineProperty(globalThis, "__broadside", { get: () => ({ session, renderer }) });
