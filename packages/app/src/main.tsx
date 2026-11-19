import { createRoot } from "react-dom/client";
import { type ColorMode, CAMERA_MODES, BabylonRenderer, DynamicResolution, type GraphicsPreset, type GraphicsSettings, SynthAudio, parseGraphics, presetSettings, withSetting } from "@broadside/engine";
import { Hud, type SteeringMode, type UiIntents, patchHud, useHud } from "@broadside/ui";
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
import { type AmmoId, clamp, type ShipClassId, type UpgradeId, type WeatherKind, WEATHER, wreckSites } from "@broadside/core";
import { bindKeyboard } from "./controllers/keyboard";
import { bindCourseGestures } from "./controllers/course-gestures";
import { presentCourse, presentWind } from "./presenters/course-presenter";
import { type TapOrder, attackDrawn, orderFor, tappedAt } from "./controllers/tap-targets";
import { presentTappables } from "./presenters/tappables";
import { Haptics, strongest } from "./feedback/haptics";
// Type of the HUD (style.css), bundled so the APK needs no network: Cinzel for titles and buttons,
// EB Garamond for the text (SIL Open Font License).
import "@fontsource/cinzel/600.css";
import "@fontsource/cinzel/700.css";
import "@fontsource/eb-garamond/400.css";
import "@fontsource/eb-garamond/400-italic.css";
import "@fontsource/eb-garamond/600.css";
import "./style.css";
import { registerServiceWorker } from "./pwa";

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
// Steering: simple (tap or draw a course, the crew sails it) by default, the classic helm on request.
const STEER_KEY = "broadside.steering";
const storedSteering = ((): SteeringMode => {
  try {
    const m = localStorage.getItem(STEER_KEY);
    return m === "classic" || m === "arcade" ? m : "simple";
  } catch {
    return "simple";
  }
})();
const urlCamera = params.get("camera");
let renderer = new BabylonRenderer({ canvas, graphics, hullsUrl: HULLS_URL, propsUrl: "assets/props/", texturesUrl: "assets/textures/" });
if (urlCamera && (CAMERA_MODES as readonly string[]).includes(urlCamera)) renderer.camera.mode = urlCamera as (typeof CAMERA_MODES)[number];
// `inspect=1`: the orbit may close in on the ship (a viewer of the model rather than the game's framing).
renderer.camera.closeUp = params.get("inspect") === "1";
// `fill=0`: no fill light on the ships (the cinematic camera's look in every camera; reference shots).
renderer.shipFill.enabled = params.get("fill") !== "0";
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
  renderer.camera.drawGestures = useHud.getState().steering === "simple";
  dynres = new DynamicResolution(next.renderScale);
  patchHud({ graphics: { preset: next.preset, colorMode: next.colorMode, renderScale: next.renderScale } });
};
patchHud({ graphics: { preset: graphics.preset, colorMode: graphics.colorMode, renderScale: graphics.renderScale }, hudHidden: params.get("hud") === "0", cameraMode: renderer.camera.mode });
if (!helpSeen) patchHud({ helpOpen: true });
patchHud({ steering: storedSteering });
renderer.camera.drawGestures = storedSteering === "simple";
// The crew's standing order to reef in squalls: on unless the player turned it off on this device.
const REEF_KEY = "broadside.reef";
const storedReef = ((): boolean => {
  try {
    return localStorage.getItem(REEF_KEY) !== "0";
  } catch {
    return true;
  }
})();
patchHud({ reef: storedReef });
session.crewOrders(storedReef);
const setReef = (on: boolean) => {
  patchHud({ reef: on });
  session.crewOrders(on);
  try {
    localStorage.setItem(REEF_KEY, on ? "1" : "0");
  } catch {
    // Storage unavailable: the choice lasts for this run only.
  }
};
// Vibration on hits and broadsides: on unless turned off on this device.
const HAPTICS_KEY = "broadside.haptics";
const storedHaptics = ((): boolean => {
  try {
    return localStorage.getItem(HAPTICS_KEY) !== "0";
  } catch {
    return true;
  }
})();
patchHud({ haptics: storedHaptics });
const setHaptics = (on: boolean) => {
  patchHud({ haptics: on });
  try {
    localStorage.setItem(HAPTICS_KEY, on ? "1" : "0");
  } catch {
    // Storage unavailable: the choice lasts for this run only.
  }
};
/** Assisted sailing for the Action steering mode (sim/systems/assist); the other modes sail by the wind. */
const applySteering = (steering: SteeringMode) => {
  session.assist(steering === "arcade");
  session.helm.steer(0);
  if (steering !== "simple") session.helm.navigate([], false);
  if (steering !== "arcade") session.helm.rudder(0);
  patchHud({ astern: false });
};
applySteering(storedSteering);
/** One gear of sail more or less (pad, W and S); below furled under assisted sailing: astern with the sails backed. */
const gear = (step: 1 | -1) => {
  const h = useHud.getState();
  const sail = h.sailing?.sailTargets[0] ?? 3;
  if (h.steering === "arcade" && step < 0 && sail === 0 && !h.astern) {
    session.assist(true, true);
    patchHud({ astern: true });
  } else if (h.astern && step > 0) {
    session.assist(true, false);
    patchHud({ astern: false });
  } else session.setSails(clamp(sail + step, 0, 4));
};
const setSteering = (steering: SteeringMode) => {
  patchHud({ steering });
  applySteering(steering);
  renderer.camera.drawGestures = steering === "simple";
  // The action mode's view is the chase camera astern (Black Flag's); the camera button still cycles.
  if (steering === "arcade" && renderer.camera.mode === "isometric") {
    renderer.camera.mode = "chase";
    patchHud({ cameraMode: "chase" });
  }
  try {
    localStorage.setItem(STEER_KEY, steering);
  } catch {
    // Storage unavailable: the choice lasts for this run only.
  }
};

const intents: UiIntents = {
  helm: {
    // Under assisted sailing the keys put the helm over like the pad; otherwise they turn the course.
    steer: (d) => (useHud.getState().steering === "arcade" ? session.helm.rudder(d) : session.helm.steer(d)),
    rudder: (x) => session.helm.rudder(x),
    gear,
  },
  orders: {
    board: (t) => shipOrder("board")(t),
    follow: (t) => shipOrder("follow")(t),
    engage: (t) => shipOrder("engage")(t),
    cancelCourse: () => session.helm.navigate([], false),
    salvage: (x, z) => issue({ kind: "salvage", at: { x, z } }),
    closeMenu: () => patchHud({ shipMenu: null }),
  },
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
    setSteering,
    setReef,
    setHaptics,
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
      session.crewOrders(useHud.getState().reef);
      applySteering(useHud.getState().steering);
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
bindKeyboard(window, intents);
addEventListener("resize", () => renderer.resize());
// Simple steering: what a tap, a long press or a drawn line on the canvas means (tap-targets), as orders to the crew.
const tappables = () => {
  const rect = canvas.getBoundingClientRect();
  const project = (wx: number, wy: number, wz: number) => {
    const p = renderer.project(wx, wy, wz);
    return { x: rect.left + p.x * rect.width, y: rect.top + p.y * rect.height };
  };
  return presentTappables(session.sim, session.playerId, project);
};
/** A course is being drawn now (the no-go zone shows meanwhile). */
let drawing = false;
const issue = (order: TapOrder) => {
  session.helm.order(order);
  renderer.course.ripple(order.at.x, order.at.z, order.kind === "stop" ? "go" : order.kind);
  patchHud({ shipMenu: null });
};
const shipOrder = (kind: "board" | "follow" | "engage") => (target: number) => {
  const t = session.sim.byId(target);
  if (t?.body) issue({ kind, target, at: { x: t.body.pos.x, z: t.body.pos.z } });
};
bindCourseGestures(canvas, {
  enabled: () => useHud.getState().steering === "simple",
  pick: (x, y) => renderer.pickWater(x, y),
  showStroke: (points) => {
    drawing = points.length > 1;
    renderer.course.setStroke(points);
  },
  tap: (x, y, append) => {
    const hit = tappedAt(x, y, tappables());
    const water = renderer.pickWater(x, y);
    if (append && !hit && water) {
      session.helm.navigate([water], false, true);
      renderer.course.ripple(water.x, water.z, "go");
      return;
    }
    const order = orderFor(hit, water);
    if (order) issue(order);
  },
  longPress: (x, y) => {
    const hit = tappedAt(x, y, tappables());
    if (hit?.kind === "ship") {
      const rect = canvas.getBoundingClientRect();
      patchHud({ shipMenu: { x: (x - rect.left) / rect.width, y: (y - rect.top) / rect.height, target: hit.id, hostile: !!hit.hostile } });
      return;
    }
    // On open water a long press adds a waypoint to the route in hand.
    const water = hit ? null : renderer.pickWater(x, y);
    if (water) {
      session.helm.navigate([water], false, true);
      renderer.course.ripple(water.x, water.z, "go");
    }
  },
  draw: (route, from, to) => {
    const items = tappables();
    const attack = attackDrawn(tappedAt(from.x, from.y, items), tappedAt(to.x, to.y, items));
    if (attack) issue(attack);
    else session.helm.navigate(route, true);
  },
});
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

const haptics = new Haptics();
// Dynamic resolution under the slider's scale when frames come too slow (off for the tools that drive
// the page, whose shots and measurements must be at the set resolution, and with `dynres=0`).
const autoResolution = params.get("dynres") !== "0" && !navigator.webdriver;
let dynres = new DynamicResolution(graphics.renderScale);
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
// `sun=<degrees>`: a fixed bearing of the sun (0 = east, 90 = north, the +z a ship starts along), for staged shots.
const sunAzimuth = params.has("sun") ? (Number(params.get("sun")) * Math.PI) / 180 : undefined;
const hoursNow = () => (clockRuns ? (startHours + session.sim.env.time / 240) % 24 : startHours);
// With no enemy about, the arrow at the screen's edge points at the nearest wreck still to be salvaged
// within WRECK_MARK metres (its sites are fixed per archipelago: computed once).
const WRECK_MARK = 900;
/** Another ship is heard (her rigging and canvas) within this distance of the listener (m). */
const NEARBY = 150;
let wrecksOf: { a: unknown; sites: ReturnType<typeof wreckSites> } | null = null;
const wreckMarker = (p: { x: number; z: number }) => {
  const a = session.sim.env.archipelago;
  if (!a) return null;
  if (wrecksOf?.a !== a) wrecksOf = { a, sites: wreckSites(a) };
  let best: { x: number; z: number; d: number } | null = null;
  wrecksOf.sites.forEach((w, i) => {
    if (session.sim.salvage.salvaged.includes(i)) return;
    const d = Math.hypot(w.x - p.x, w.z - p.z);
    if (d < WRECK_MARK && (!best || d < best.d)) best = { x: w.x, z: w.z, d };
  });
  const w = best as { x: number; z: number; d: number } | null;
  if (!w) return null;
  const m = presentMarker(renderer.project(w.x, 0, w.z), w.d);
  return m ? { ...m, kind: "wreck" as const, at: { x: w.x, z: w.z } } : null;
};
const frame = (now: number) => {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  session.advance(dt);
  const scale = autoResolution ? dynres.update(dt) : null;
  if (scale !== null) renderer.setRenderScale(scale);
  const events = session.sim.drainEvents();
  renderer.onEvents(events);
  haptics.enabled = useHud.getState().haptics;
  haptics.play(strongest(events, session.playerId), now / 1000);
  const listener = { x: renderer.camera.camera.target.x, z: renderer.camera.camera.target.z, heading: renderer.camera.viewHeading() };
  for (const e of events) {
    const cue = cueFor(e, session.playerId, (id) => {
      const b = session.sim.byId(id)?.body;
      return b ? { x: b.pos.x, z: b.pos.z } : null;
    });
    if (cue) audio.play(cue, listener);
    const n = noticeFor(e, session.playerId);
    if (n) pushNotice(n);
  }
  audio.setAmbience(presentAmbience(session.sim, listener.x, listener.z, session.playerId));
  const aboard = presentShipAudio(session.sim, session.playerId, renderer.camera.camera.radius, hoursNow());
  if (aboard) audio.setShip(aboard);
  // The nearest other ship within NEARBY metres is heard too (her ropes and canvas), from her side.
  let near: { id: number; d: number; x: number; z: number } | null = null;
  for (const o of session.sim.ships()) {
    if (o.id === session.playerId || !o.body || o.ship?.sinking) continue;
    const d = Math.hypot(o.body.pos.x - listener.x, o.body.pos.z - listener.z);
    if (d < NEARBY && (!near || d < near.d)) near = { id: o.id, d, x: o.body.pos.x, z: o.body.pos.z };
  }
  const nearState = near ? presentShipAudio(session.sim, near.id, 0, hoursNow()) : null;
  audio.setNearby(nearState && near ? { ...nearState, aboard: 0.5 * (1 - near.d / NEARBY) } : null, near ? Math.sin(Math.atan2(near.x - listener.x, near.z - listener.z) - listener.heading) : 0);
  renderer.salvo.visible = !useHud.getState().hudHidden;
  renderer.salvo.set(salvoPreview(session.sim, session.playerId));
  const course = presentCourse(session.sim, session.playerId);
  renderer.course.visible = !useHud.getState().hudHidden;
  renderer.course.setRoute(course.path, course.goal);
  renderer.course.setWind(presentWind(session.sim, session.playerId, drawing, course.goal ?? course.path[course.path.length - 1] ?? null));
  if (useHud.getState().courseActive !== (course.path.length > 0)) patchHud({ courseActive: course.path.length > 0 });
  const focus = combatFocus(session.sim, session.playerId);
  renderer.focus = focus;
  renderer.frame(session.sim, { hours: hoursNow(), ...(sunAzimuth === undefined ? {} : { sunAzimuth }), overcast: Number(params.get("overcast") ?? 0.55), fog: 0 }, dt);
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
    marker: me?.body ? (focus ? presentMarker(renderer.project(focus.x, 2, focus.z), Math.hypot(focus.x - me.body.pos.x, focus.z - me.body.pos.z)) : wreckMarker(me.body.pos)) : null,
    gold: session.sim.purse.gold,
    provisions: session.sim.purse.provisions,
  });
  requestAnimationFrame(frame);
};
requestAnimationFrame(frame);
Object.defineProperty(globalThis, "__broadside", { get: () => ({ session, renderer, audio, wrecks: () => (session.sim.env.archipelago ? wreckSites(session.sim.env.archipelago) : []) }) });

// Installable and offline once opened (PWA): the service worker in a browser, not in the Android app.
registerServiceWorker();
