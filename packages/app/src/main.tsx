import { createRoot } from "react-dom/client";
import { type ColorMode, CAMERA_MODES, BabylonRenderer, type GraphicsPreset, type GraphicsSettings, SynthAudio, parseGraphics, presetSettings, withSetting } from "@broadside/engine";
import { Hud, type UiIntents, patchHud, useHud } from "@broadside/ui";
import { GameSession } from "./game-session";
import { localSaveStore } from "./save-store";
import { readSave, writeSave } from "@broadside/persistence";
import { type SimSnapshot } from "@broadside/sim";
import { presentJob, presentPort } from "./presenters/port-presenter";
import { presentShipAudio } from "./presenters/ship-audio-presenter";
import { combatFocus, salvoPreview } from "./aiming";
import { presentMarker } from "./presenters/marker-presenter";
import { presentAmbience } from "./presenters/ambience-presenter";
import { presentSailing } from "./presenters/sailing-presenter";
import { presentCombat, presentTarget } from "./presenters/combat-presenter";
import { cueFor, noticeFor } from "./presenters/event-presenter";
import { type AmmoId, type ShipClassId, type UpgradeId, type WeatherKind, WEATHER, wreckSites } from "@broadside/core";
import { bindKeyboard } from "./controllers/keyboard";
import "./style.css";

/** Composition root (ADR-0001): wires session, renderer, HUD and input. */
// A page that cannot carry a query string (the ship viewer published as an artifact) sets the options itself.
const params = new URLSearchParams((globalThis as { __broadsideQuery?: string }).__broadsideQuery ?? location.search);
const seed = Number(params.get("seed") ?? 1797);
const touch = matchMedia("(pointer: coarse)").matches;
const canvas = document.getElementById("game") as HTMLCanvasElement;
const weatherParam = params.get("weather");
const weather = weatherParam && weatherParam in WEATHER ? (weatherParam as WeatherKind) : "fresh";
// Continue the autosave if there is one (unless the address asks for a fresh seed).
const store = localSaveStore();
/** Set once the player has closed the how-to-play card. */
const HELP_KEY = "broadside.help";
// First start: show how to play (closed once, remembered).
const helpSeen = ((): boolean => {
  try {
    return localStorage.getItem(HELP_KEY) === "1";
  } catch {
    return false;
  }
})();
const saved = params.has("seed") ? null : await readSave(store, "autosave").catch(() => null);
let session = saved ? new GameSession({ seed, weather }, saved.data as SimSnapshot) : new GameSession({ seed, weather });
// Graphics settings: stored on this device (a per-viewer convenience), a URL preset overrides.
const GFX_KEY = "broadside.graphics";
/** Modelled hulls (tools/assets), served beside the page in the web build and in the APK. */
const HULLS_URL = params.get("hulls") === "0" ? undefined : "assets/hulls/";
const readStored = (): string | null => {
  try {
    return localStorage.getItem(GFX_KEY);
  } catch {
    return null;
  }
};
const urlPreset = params.get("quality");
const stored = parseGraphics(readStored(), touch);
let graphics: GraphicsSettings = urlPreset && ["low", "medium", "high", "ultra", "cinematic"].includes(urlPreset) ? presetSettings(urlPreset as GraphicsPreset, stored.colorMode) : stored;
const urlColor = params.get("color");
if (urlColor === "sepia" || urlColor === "natural" || urlColor === "vibrant") graphics = { ...graphics, colorMode: urlColor };
const urlCamera = params.get("camera");
let renderer = new BabylonRenderer({ canvas, graphics, hullsUrl: HULLS_URL, propsUrl: "assets/props/", texturesUrl: "assets/textures/" });
if (urlCamera && (CAMERA_MODES as readonly string[]).includes(urlCamera)) renderer.camera.mode = urlCamera as (typeof CAMERA_MODES)[number];
// `inspect=1`: the orbit may close in on the ship (a viewer of the model rather than the game's framing).
renderer.camera.closeUp = params.get("inspect") === "1";
const applyGraphics = (next: GraphicsSettings) => {
  graphics = next;
  try {
    localStorage.setItem(GFX_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable: the choice lasts for this run only.
  }
  const mode = renderer.camera.mode;
  renderer.dispose();
  renderer = new BabylonRenderer({ canvas, graphics, hullsUrl: HULLS_URL, propsUrl: "assets/props/", texturesUrl: "assets/textures/" });
  renderer.camera.mode = mode;
  patchHud({ graphics: { preset: next.preset, colorMode: next.colorMode, renderScale: next.renderScale } });
};
patchHud({ graphics: { preset: graphics.preset, colorMode: graphics.colorMode, renderScale: graphics.renderScale }, hudHidden: params.get("hud") === "0", cameraMode: renderer.camera.mode });
if (!helpSeen) patchHud({ helpOpen: true });

const intents: UiIntents = {
  helm: { steer: (d) => session.steer(d) },
  sails: { setSails: (l) => session.setSails(l), setMastSails: (m, l) => session.setMastSails(m, l), toggleOars: () => session.toggleOars() },
  port: {
    trade: (service, qty, ammo) => {
      const p = useHud.getState().port;
      if (p) session.trade(p.index, service, qty, ammo as AmmoId | undefined);
    },
    takeContract: () => {
      const p = useHud.getState().port;
      if (p) session.takeContract(p.index);
    },
    refit: (upgrade) => {
      const p = useHud.getState().port;
      if (p) session.refit(p.index, upgrade as UpgradeId);
    },
    buyShip: (classId) => {
      const p = useHud.getState().port;
      if (p) session.buyShip(p.index, classId as ShipClassId);
    },
  },
  combat: {
    fire: (mount, side) => session.fire(mount, side),
    loadAmmo: (ammo) => session.loadAmmo(ammo as AmmoId),
    brace: () => session.brace(),
    drop: (kind) => session.drop(kind),
    special: (mount) => session.special(mount),
    assault: () => session.assault(),
    board: () => session.board(),
  },
  settings: {
    setLanguage: (language) => patchHud({ language }),
    setGraphicsPreset: (p) => applyGraphics(presetSettings(p as GraphicsPreset, graphics.colorMode)),
    setColorMode: (c) => applyGraphics({ ...graphics, colorMode: c as ColorMode }),
    setRenderScale: (scale) => applyGraphics(withSetting(graphics, "renderScale", scale)),
    toggleSettings: () => patchHud({ settingsOpen: !useHud.getState().settingsOpen }),
    toggleHelp: () => {
      const open = !useHud.getState().helpOpen;
      patchHud({ helpOpen: open, settingsOpen: false });
      if (!open) {
        try {
          localStorage.setItem(HELP_KEY, "1");
        } catch {
          // Storage can be unavailable (private mode): the card simply shows again next time.
        }
      }
    },
    newGame: () => {
      session = new GameSession({ seed: (seed + Math.floor(performance.now())) % 100000, weather });
      applyGraphics(graphics);
      patchHud({ settingsOpen: false });
    },
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
const audio = new SynthAudio("assets/audio/");
addEventListener("pointerdown", () => audio.unlock());
addEventListener("keydown", () => audio.unlock());
// Autosave every minute and when the app goes to the background (phones kill background apps).
const autosave = () => void writeSave(store, "autosave", session.save(), new Date().toISOString());
setInterval(autosave, 60_000);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") autosave();
});
let noticeId = 0;
const pushNotice = (key: string) => {
  if (useHud.getState().notices.some((n) => n.key === key)) return;
  const id = ++noticeId;
  patchHud({ notices: [...useHud.getState().notices.slice(-3), { id, key }] });
  setTimeout(() => patchHud({ notices: useHud.getState().notices.filter((n) => n.id !== id) }), 3500);
};

let last = performance.now();
let fpsAcc = 0;
let frames = 0;
// One game hour passes in four minutes (a day in an hour and a half).
/** Hour of day to start at (`hours=21` or `hours=21:30`); `clock=stop` holds it (fixed light for shots). */
const parseHours = (v: string | null): number => {
  if (!v) return 16.3;
  const [h, m] = v.split(":");
  const hours = Number(h) + Number(m ?? 0) / 60;
  return Number.isFinite(hours) ? ((hours % 24) + 24) % 24 : 16.3;
};
const startHours = parseHours(params.get("hours"));
const clockRuns = params.get("clock") !== "stop";
const hoursNow = () => (clockRuns ? (startHours + session.sim.env.time / 240) % 24 : startHours);
const frame = (now: number) => {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  session.advance(dt);
  const events = session.sim.drainEvents();
  renderer.onEvents(events);
  const listener = { x: renderer.camera.camera.target.x, z: renderer.camera.camera.target.z, heading: renderer.camera.viewHeading() };
  for (const e of events) {
    const cue = cueFor(e, session.playerId);
    if (cue) audio.play(cue, listener);
    const n = noticeFor(e, session.playerId);
    if (n) pushNotice(n);
  }
  audio.setAmbience(presentAmbience(session.sim, listener.x, listener.z, session.playerId));
  const aboard = presentShipAudio(session.sim, session.playerId, renderer.camera.camera.radius, hoursNow());
  if (aboard) audio.setShip(aboard);
  renderer.salvo.visible = !useHud.getState().hudHidden;
  renderer.salvo.set(salvoPreview(session.sim, session.playerId));
  const focus = combatFocus(session.sim, session.playerId);
  renderer.focus = focus;
  renderer.frame(session.sim, { hours: hoursNow(), overcast: Number(params.get("overcast") ?? 0.55), fog: 0 }, dt);
  fpsAcc += dt;
  frames++;
  if (fpsAcc > 0.5) {
    patchHud({ fps: frames / fpsAcc, drawCalls: renderer.drawCalls() });
    fpsAcc = 0;
    frames = 0;
  }
  const me = session.sim.byId(session.playerId);
  patchHud({
    sailing: presentSailing(session.sim, session.playerId),
    combat: me ? presentCombat(me, session.sim.forts(), session.sim.ships()) : null,
    target: me?.body ? presentTarget(session.sim, me) : null,
    port: me?.body ? presentPort(session.sim, me) : null,
    job: me?.body ? presentJob(session.sim, me) : null,
    marker: focus && me?.body ? presentMarker(renderer.project(focus.x, 2, focus.z), Math.hypot(focus.x - me.body.pos.x, focus.z - me.body.pos.z)) : null,
    gold: session.sim.purse.gold,
    provisions: session.sim.purse.provisions,
  });
  requestAnimationFrame(frame);
};
requestAnimationFrame(frame);
Object.defineProperty(globalThis, "__broadside", { get: () => ({ session, renderer, audio, wrecks: () => (session.sim.env.archipelago ? wreckSites(session.sim.env.archipelago) : []) }) });
