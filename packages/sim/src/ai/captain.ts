import { type AmmoId, type GameCommand, type Relations, type SailLevel, isHostile, standing, wrapAngle, yawOf, rotateInv } from "@broadside/core";
import { type Entity } from "../world/components";
import { type ShipState, crewShare } from "../ship/ship-state";
import { type CaptainState } from "./captain-state";
import { relativeBearing, sailableHeading } from "./navigation";
import { canBoard } from "../combat/boarding";
import { type Screen, smokeBetween } from "../combat/smoke";

/**
 * Decisions of an AI captain (finite state machine: patrol -> engage -> flee -> struck). Each
 * decision returns commands: the captain commands its ship through the same Command interface
 * as the player, so AI and player obey the same rules.
 */
export interface World2D {
  readonly windDirection: number;
  /** Fog 0..1 shortens how far a lookout sees. */
  readonly fog: number;
  /** Seabed height at a point (null: open sea everywhere). */
  readonly bed: ((x: number, z: number) => number) | null;
  readonly ships: readonly Entity[];
  readonly rng: () => number;
  /** Ports merchants sail between (empty: open sea). */
  readonly ports: readonly { readonly x: number; readonly z: number }[];
  /** The player's standing with each faction (null: standings at the start of a game). */
  readonly relations: Relations | null;
  /** Smoke screens on the water (lookouts cannot see through them). */
  readonly screens: readonly Screen[];
}

const DETECT = 900;
/** Hunters know roughly where the player sails (word in the taverns) and seek her out. */
const HUNT_RANGE = 3200;
/** Merchants run from enemies closer than this. */
const MERCHANT_WARY = 600;
const BROADSIDE_MAX = 430;
/** The captain orders a broadside when the guns can train onto the target (their limit is ~0.14). */
const ARC = 0.13;

/**
 * Obstacle avoidance (Reynolds, "Steering Behaviors For Autonomous Characters", 1999): probe the
 * seabed along a heading; if land or a shoal lies within the look-ahead, try headings swinging
 * out to either side until one is clear.
 */
const LOOKAHEAD = [60, 130, 250];
const clearHeading = (me: Entity, heading: number, w: World2D): number => {
  if (!w.bed) return heading;
  const b = me.body!;
  const keel = -me.ship!.model.def.hull.draft - 2;
  const clear = (h: number): boolean => LOOKAHEAD.every((d) => w.bed!(b.pos.x + Math.sin(h) * d, b.pos.z + Math.cos(h) * d) < keel);
  if (clear(heading)) return heading;
  for (let k = 1; k <= 8; k++) {
    for (const sgn of [1, -1]) {
      const h = heading + sgn * k * 0.3;
      if (clear(h)) return wrapAngle(h);
    }
  }
  return wrapAngle(heading + Math.PI);
};

const hullShare = (s: ShipState): number => s.sections.reduce((a, x) => a + x.hp, 0) / (s.model.def.sectionHp * s.sections.length);

export const hostileTo = (a: ShipState, b: ShipState, rel: Relations | null = null): boolean => isHostile(standing(a.faction, b.faction, rel));

const nearestHostile = (me: Entity, ships: readonly Entity[], fog: number, rel: Relations | null, smoke: readonly Screen[]): Entity | null => {
  let best: Entity | null = null;
  let bestD = DETECT * (1 - 0.7 * fog);
  for (const o of ships) {
    if (o.id === me.id || o.ship!.sinking || o.ship!.struck || !hostileTo(me.ship!, o.ship!, rel)) continue;
    if (smokeBetween(smoke, me.body!.pos.x, me.body!.pos.z, o.body!.pos.x, o.body!.pos.z)) continue;
    const d = Math.hypot(o.body!.pos.x - me.body!.pos.x, o.body!.pos.z - me.body!.pos.z);
    if (d < bestD) {
      bestD = d;
      best = o;
    }
  }
  return best;
};

const sideLoaded = (s: ShipState, side: "port" | "starboard"): number =>
  s.model.guns.filter((g, i) => g.kind === "broadside" && g.side === side && s.guns[i]!.reload === 0 && !s.guns[i]!.dismounted).length;

const chooseAmmo = (me: ShipState, target: ShipState, range: number): AmmoId => {
  if (range < 90 && (me.stores.grape ?? 0) > 0) return "grape";
  const targetFast = target.sailSet.reduce((a, b) => a + b, 0) > me.sailSet.reduce((a, b) => a + b, 0);
  if (targetFast && range > 120 && range < 330 && (me.stores.chain ?? 0) > 0) return "chain";
  if (range < 200 && (me.stores.heavy ?? 0) > 0) return "heavy";
  return "round";
};

const engage = (me: Entity, c: CaptainState, t: Entity, w: World2D): GameCommand[] => {
  const s = me.ship!;
  const b = me.body!;
  const tb = t.body!;
  const heading = yawOf(b.rot);
  const range = Math.hypot(tb.pos.x - b.pos.x, tb.pos.z - b.pos.z);
  // Lead the target by the shot's time of flight.
  const tof = range / 95;
  const px = tb.pos.x + tb.vel.x * tof;
  const pz = tb.pos.z + tb.vel.z * tof;
  const brg = Math.atan2(px - b.pos.x, pz - b.pos.z);
  const aimRange = Math.hypot(px - b.pos.x, pz - b.pos.z);
  const port = sideLoaded(s, "port");
  const stbd = sideLoaded(s, "starboard");
  const rel = relativeBearing(heading, b.pos.x, b.pos.z, px, pz);
  if (port === 0 && stbd > 0) c.side = "starboard";
  else if (stbd === 0 && port > 0) c.side = "port";
  else if (port > 0 && stbd > 0) c.side = rel >= 0 ? "starboard" : "port";
  const abeam = c.side === "starboard" ? Math.PI / 2 : -Math.PI / 2;
  // Out of gun range: chase almost bow-on. In range: lie broadside on, easing towards the
  // preferred range (a proportional bias, clamped).
  // With a loaded side in range the captain bears up to fire (no bias); while reloading he
  // works towards his range.
  const loadedInRange = range < BROADSIDE_MAX && sideLoaded(s, c.side) > 0;
  const closeBias = range > BROADSIDE_MAX * 0.85 && !loadedInRange ? 1.2 : loadedInRange ? 0 : Math.max(-0.5, Math.min(0.5, (range - c.range) / c.range)) * 0.8;
  const desired = brg - abeam + (c.side === "starboard" ? closeBias : -closeBias);
  const cmds: GameCommand[] = [{ type: "course", ship: me.id, heading: clearHeading(me, sailableHeading(desired, w.windDirection, s), w) }];
  const level: SailLevel = range > c.range * 1.4 ? 3 : 2;
  if (s.sailTarget[0] !== level) cmds.push({ type: "sails", ship: me.id, mast: "all", level });
  const want = chooseAmmo(s, t.ship!, range);
  if (s.ammoLoad.broadside !== want && sideLoaded(s, c.side) === 0) cmds.push({ type: "loadAmmo", ship: me.id, mount: "broadside", ammo: want });
  if (range < BROADSIDE_MAX && Math.abs(wrapAngle(rel - abeam)) < ARC && sideLoaded(s, c.side) > 0) cmds.push({ type: "fire", ship: me.id, mount: "broadside", side: c.side, range: aimRange, bearing: brg });
  if (range < 420 && Math.abs(rel) < 0.18) cmds.push({ type: "fire", ship: me.id, mount: "bowChaser", range: aimRange, bearing: brg });
  if (range < 380 && Math.abs(wrapAngle(rel - Math.PI)) < 0.2) cmds.push({ type: "fire", ship: me.id, mount: "sternChaser", range: aimRange, bearing: brg });
  if (range > 150 && range < 750) cmds.push({ type: "fire", ship: me.id, mount: "mortar", range: aimRange, bearing: brg });
  if (range < 120) cmds.push({ type: "fire", ship: me.id, mount: "swivel", side: rel >= 0 ? "starboard" : "port", range });
  // Close aboard with a stronger crew: grapple and board (pirates love it).
  const boarders = s.faction === "pirates" ? 1.1 : 1.6;
  if (canBoard(me, t) && s.crew > t.ship!.crew * boarders) cmds.push({ type: "board", ship: me.id, target: t.id });
  if (range < 110 && Math.abs(wrapAngle(rel - Math.PI)) < 0.4 && w.rng() < 0.05) cmds.push({ type: "drop", ship: me.id, ammo: w.rng() < 0.5 ? "fireBarrel" : "mine" });
  return cmds;
};

/** Next port for a merchant: any but the one it is leaving, picked from the stream. */
const nextPort = (c: CaptainState, w: World2D): void => {
  if (w.ports.length === 0) return;
  let k = Math.floor(w.rng() * w.ports.length);
  if (k === c.dest && w.ports.length > 1) k = (k + 1) % w.ports.length;
  c.dest = k;
  c.wx = w.ports[k]!.x;
  c.wz = w.ports[k]!.z;
};

const patrol = (me: Entity, c: CaptainState, w: World2D): GameCommand[] => {
  const b = me.body!;
  if (c.role === "trade" && (c.dest < 0 || Math.hypot(c.wx - b.pos.x, c.wz - b.pos.z) < 260)) nextPort(c, w);
  else if (Math.hypot(c.wx - b.pos.x, c.wz - b.pos.z) < 120) {
    c.wx = b.pos.x + (w.rng() - 0.5) * 1600;
    c.wz = b.pos.z + (w.rng() - 0.5) * 1600;
  }
  const desired = Math.atan2(c.wx - b.pos.x, c.wz - b.pos.z);
  return [
    { type: "course", ship: me.id, heading: clearHeading(me, sailableHeading(desired, w.windDirection, me.ship!), w) },
    ...(me.ship!.sailTarget[0] !== 3 ? [{ type: "sails" as const, ship: me.id, mast: "all" as const, level: 3 as SailLevel }] : []),
  ];
};

const flee = (me: Entity, t: Entity | null, w: World2D): GameCommand[] => {
  const b = me.body!;
  const away = t ? Math.atan2(b.pos.x - t.body!.pos.x, b.pos.z - t.body!.pos.z) : yawOf(b.rot);
  return [
    { type: "course", ship: me.id, heading: clearHeading(me, sailableHeading(away, w.windDirection, me.ship!), w) },
    { type: "sails", ship: me.id, mast: "all", level: 3 },
  ];
};

/** The player's ship, if a hunter can find her (hunters only chase hostile quarry). */
const quarry = (me: Entity, ships: readonly Entity[], rel: Relations | null): Entity | null => {
  const p = ships.find((o) => o.player && !o.ship!.sinking && hostileTo(me.ship!, o.ship!, rel));
  if (!p) return null;
  return Math.hypot(p.body!.pos.x - me.body!.pos.x, p.body!.pos.z - me.body!.pos.z) < HUNT_RANGE ? p : null;
};

/** One decision of the captain; mutates its state and returns the commands it gives. */
export const decide = (me: Entity, c: CaptainState, w: World2D): GameCommand[] => {
  const s = me.ship!;
  if (c.mode === "struck") return [];
  const seen = (x: Entity): boolean => !smokeBetween(w.screens, me.body!.pos.x, me.body!.pos.z, x.body!.pos.x, x.body!.pos.z);
  const target = c.target === null ? null : (w.ships.find((x) => x.id === c.target && !x.ship!.sinking && !x.ship!.struck && seen(x)) ?? null);
  if (crewShare(s) < 0.15 || hullShare(s) < 0.15) {
    c.mode = "struck";
    s.struck = true;
    return [{ type: "sails", ship: me.id, mast: "all", level: 0 }];
  }
  if (crewShare(s) < 0.3 || hullShare(s) < 0.3) {
    c.mode = "flee";
    return flee(me, target, w);
  }
  const t = target ?? nearestHostile(me, w.ships, w.fog, w.relations, w.screens) ?? (c.role === "hunt" ? quarry(me, w.ships, w.relations) : null);
  c.target = t?.id ?? null;
  if (t && c.role === "trade") {
    const d = Math.hypot(t.body!.pos.x - me.body!.pos.x, t.body!.pos.z - me.body!.pos.z);
    if (d < MERCHANT_WARY) {
      c.mode = "flee";
      return flee(me, t, w);
    }
    c.target = null;
    c.mode = "patrol";
    return patrol(me, c, w);
  }
  if (!t) {
    c.mode = "patrol";
    return patrol(me, c, w);
  }
  c.mode = "engage";
  return engage(me, c, t, w);
};

/** Forward speed of a ship (m/s), for tests and the HUD of enemies. */
export const forwardSpeed = (e: Entity): number => rotateInv(e.body!.rot, e.body!.vel).z;
