/**
 * What a ship sounds like to those aboard, decided from her state (pure, tested): a sound director
 * in the manner of layered game audio (continuous beds whose gains follow the state, plus one-shots
 * fired by rules with their own timers). The state comes from the simulation through a presenter;
 * the output names clips and synthesised voices for ShipSounds to play.
 *
 * Rules, each from what happens on a sailing ship:
 * - deck: the hull's timbers work with the heel and the load on the masts (a bed);
 * - wash: water along the side, with the speed through the water (a bed);
 * - rig: the wind in the rigging, an aeolian tone (vortex shedding: frequency = 0.2 x wind / line
 *   diameter, Strouhal's relation), from a fresh breeze up (a bed);
 * - strain: ropes groan as the load comes on, sooner under more load and at once in a gust;
 * - haul: blocks and running feet while the crew set or take in sail; braces when she turns;
 * - luff: canvas shakes when a sail is starved of wind, and cracks full when it fills again;
 * - steps: the watch walks the deck;
 * - bell: the ship's bell every half hour of the watch, one to eight strokes in pairs;
 * - runOut: a carriage rumbles as a reloaded gun is run out;
 * - slap: the bow comes down on a sea;
 * - pump: the chain pump clanks while she takes in water.
 */
export interface ShipAudioState {
  /** 0..1 how much the listener is aboard (1: on deck, low: far above). */
  readonly aboard: number;
  /** Speed through the water (m/s). */
  readonly speed: number;
  /** Apparent wind (m/s). */
  readonly wind: number;
  /** Highest mast load, 1 = at its limit. */
  readonly load: number;
  /** 0..1 share of the set sails that are luffing. */
  readonly luff: number;
  /** Heel (radians, absolute). */
  readonly heel: number;
  /** Vertical speed of the bow (m/s, negative down). */
  readonly bow: number;
  /** Sail set summed over the masts (to hear it change). */
  readonly canvas: number;
  /** Rate of turn (rad/s, absolute). */
  readonly turn: number;
  /** Guns loaded and run out. */
  readonly ready: number;
  /** Water in the hull (m^3). */
  readonly water: number;
  /** Time of day in half hours since midnight (whole number: the bell strikes when it changes). */
  readonly halfHour: number;
}

export type ShipVoice = "rope1" | "rope2" | "rope3" | "step1" | "step2" | "step3" | "run1" | "run2" | "winch2" | "splash" | "flap" | "crack" | "rumble" | "bell";

export interface ShipShot {
  readonly voice: ShipVoice;
  readonly gain: number;
  /** Stereo position -1..1. */
  readonly pan: number;
  /** Playback rate (pitch). */
  readonly rate: number;
  /** Seconds from now. */
  readonly delay: number;
}

export interface ShipSoundPlan {
  readonly deck: number;
  readonly wash: number;
  /** Cut-off of the wash (Hz): brighter with speed. */
  readonly washTone: number;
  readonly rig: number;
  /** Frequency of the rigging's tone (Hz). */
  readonly rigTone: number;
  readonly shots: readonly ShipShot[];
}

/** Timers and the last state seen (owned by the caller, mutated by `planShipSounds`). */
export interface ShipSoundMemory {
  strain: number;
  gust: number;
  haul: number;
  brace: number;
  luff: number;
  steps: number;
  slap: number;
  pump: number;
  runOut: number;
  last: ShipAudioState | null;
  luffing: boolean;
}

export const newShipSoundMemory = (): ShipSoundMemory => ({ strain: 3, gust: 0, haul: 0, brace: 0, luff: 0, steps: 5, slap: 0, pump: 0, runOut: 0, last: null, luffing: false });

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
/** Diameter of a shroud (m) for the rigging's tone. */
const LINE = 0.012;

/** Strokes of the bell at a half hour of the day: one to eight, the eight ending each four-hour watch. */
export const bellStrokes = (halfHour: number): number => ((((halfHour % 8) + 8) % 8) || 8);

/**
 * One step of the director. `rnd` gives uniform numbers 0..1 (variation of timing, pitch and
 * place). Mutates `m`.
 */
export const planShipSounds = (s: ShipAudioState, m: ShipSoundMemory, dt: number, rnd: () => number): ShipSoundPlan => {
  const shots: ShipShot[] = [];
  const a = clamp01(s.aboard);
  const fire = (voice: ShipVoice, gain: number, rate = 1, delay = 0, pan = rnd() * 1.4 - 0.7): void => {
    if (gain * a > 0.01) shots.push({ voice, gain: gain * a, pan, rate, delay });
  };
  const last = m.last ?? s;
  const load = clamp01(s.load);
  for (const k of ["strain", "gust", "haul", "brace", "luff", "steps", "slap", "pump", "runOut"] as const) m[k] = Math.max(0, m[k] - dt);

  // Ropes take the strain: regularly under load, and at once when a gust brings it on.
  const rising = dt > 0 ? (s.load - last.load) / dt : 0;
  if (load > 0.2 && (m.strain === 0 || (rising > 0.2 && m.gust === 0))) {
    fire(rnd() < 0.5 ? "rope1" : "rope2", 0.15 + 0.4 * load, 0.6 + rnd() * 0.2);
    m.strain = (9 - 6 * load) * (0.7 + rnd() * 0.6);
    m.gust = 2.5;
  }
  // Sail handling: blocks run and feet pound while canvas is set or taken in.
  const working = dt > 0 && Math.abs(s.canvas - last.canvas) / dt > 0.01;
  if (working && m.haul === 0) {
    fire(rnd() < 0.5 ? "rope3" : "rope2", 0.4, 1.1 + rnd() * 0.3);
    for (let i = 0; i < 3; i++) fire(i % 2 ? "run1" : "run2", 0.3, 0.9 + rnd() * 0.2, 0.15 + i * 0.22);
    m.haul = 1.1 + rnd() * 0.5;
  }
  // The yards are braced round as she turns.
  if (s.turn > 0.03 && m.brace === 0) {
    fire("rope3", 0.25, 1.25 + rnd() * 0.2);
    m.brace = 3.5 + rnd() * 2;
  }
  // Canvas shaking in the wind's eye, and the crack as it fills.
  if (s.luff > 0.3 && m.luff === 0) {
    fire("flap", 0.25 + 0.4 * s.luff, 0.8 + rnd() * 0.5);
    m.luff = 0.45 + rnd() * 0.7;
  }
  if (m.luffing && s.luff < 0.1 && s.wind > 4) fire("crack", 0.6, 0.9 + rnd() * 0.2);
  if (s.luff > 0.5) m.luffing = true;
  else if (s.luff < 0.1) m.luffing = false;
  // The watch on deck.
  if (m.steps === 0) {
    const first = rnd();
    for (let i = 0; i < 2 + Math.floor(rnd() * 3); i++) fire(`step${1 + ((Math.floor(first * 3) + i) % 3)}` as ShipVoice, 0.18, 0.9 + rnd() * 0.2, i * 0.55, first * 1.2 - 0.6);
    m.steps = 6 + rnd() * 9;
  }
  // The bell, in pairs of strokes.
  if (s.halfHour !== last.halfHour) {
    const n = bellStrokes(s.halfHour);
    for (let i = 0; i < n; i++) fire("bell", 0.5, 1, Math.floor(i / 2) * 1.5 + (i % 2) * 0.55, 0);
  }
  // A gun reloaded and run out.
  if (s.ready > last.ready && m.runOut === 0) {
    fire("rumble", 0.35, 0.9 + rnd() * 0.2);
    m.runOut = 0.35;
  }
  // The bow coming down on a sea.
  if (s.bow < -1.1 && last.bow >= -1.1 && s.speed > 2 && m.slap === 0) {
    fire("splash", Math.min(0.5, 0.15 + 0.1 * -s.bow), 0.65 + rnd() * 0.15, 0, 0);
    m.slap = 2.5;
  }
  // The pump while there is water in her.
  if (s.water > 0.5 && m.pump === 0) {
    fire("winch2", 0.25, 0.75 + rnd() * 0.1);
    m.pump = 2.6;
  }
  m.last = s;
  const wind = Math.max(0, s.wind);
  return {
    deck: a * (0.1 + 0.5 * clamp01(s.heel / 0.3 + load * 0.3)),
    wash: a * 0.45 * Math.pow(clamp01(s.speed / 8), 1.5),
    washTone: 350 + 260 * Math.max(0, s.speed),
    rig: a * 0.22 * clamp01((wind - 7) / 12),
    rigTone: (0.2 * wind) / LINE,
    shots,
  };
};
