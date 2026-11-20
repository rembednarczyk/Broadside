import { DISABLED, DOCTRINES, type AmmoId, damageState, type GameCommand, type Relations, type SailLevel, angleOffWind, isHostile, standing, wrapAngle, yawOf, rotateInv } from "@broadside/core";
import { type Entity } from "../world/components";
import { type ShipState, crewShare, hullShare, shipCondition } from "../ship/ship-state";
import { type CaptainState } from "./captain-state";
import { wayPoint } from "./waypoints";
import { closeHauled, relativeBearing, sailableHeading } from "./navigation";
import { canBoard } from "../combat/boarding";
import { aimHeightFor, firesAtRigging, lineStation, tacticalHeading } from "./tactics";
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
  readonly ports: readonly { readonly ax: number; readonly az: number }[];
  /** The player's standing with each faction (null: standings at the start of a game). */
  readonly relations: Relations | null;
  /** Smoke screens on the water (lookouts cannot see through them). */
  readonly screens: readonly Screen[];
  /** Shore forts (navies bombard and storm the forts of nations they are at war with). */
  readonly forts: readonly Entity[];
}

const DETECT = 900;
/** Hunters know roughly where the player sails (word in the taverns) and seek her out. */
const HUNT_RANGE = 3200;
/** Merchants run from enemies closer than this. */
const MERCHANT_WARY = 600;
const BROADSIDE_MAX = 430;
/** The captain orders a broadside when the guns can train onto the target (their limit is 0.3). */
const ARC = 0.28;

/**
 * Obstacle avoidance (Reynolds, "Steering Behaviors For Autonomous Characters", 1999): probe the
 * seabed along a heading; if land or a shoal lies within the look-ahead, try headings swinging
 * out to either side until one is clear.
 */
const LOOKAHEAD = [60, 130, 250];
/**
 * Seconds of way ahead probed besides: a frigate at 5 m/s turns in a circle wider than 250 m and
 * ran aground in a fight close under the land (playtest audit 19.11), so a fast ship looks further.
 */
const AHEAD_SECONDS = 70;
/** `reach`: how far off the point she steers for lies (m); the probes stop short of it (a point close under the land, a wreck on her shoal, is reached). */
export const clearHeading = (me: Entity, heading: number, w: Pick<World2D, "bed" | "windDirection">, reach = Infinity): number => {
  if (!w.bed) return heading;
  const b = me.body!;
  const keel = -me.ship!.model.def.hull.draft - 2;
  const ahead = Math.hypot(b.vel.x, b.vel.z) * AHEAD_SECONDS;
  const probes = (ahead > 250 ? [...LOOKAHEAD, ahead] : LOOKAHEAD).map((d) => Math.min(d, reach));
  const clear = (h: number): boolean => probes.every((d) => w.bed!(b.pos.x + Math.sin(h) * d, b.pos.z + Math.cos(h) * d) < keel);
  // A way round the shoal must also be a heading the ship can sail (not into the eye of the wind).
  const sailable = (h: number): boolean => me.ship!.oars || angleOffWind(h, w.windDirection) <= Math.PI - closeHauled(me.ship!);
  if (clear(heading)) return heading;
  for (let k = 1; k <= 10; k++) {
    for (const sgn of [1, -1]) {
      const h = wrapAngle(heading + sgn * k * 0.3);
      if (clear(h) && sailable(h)) return h;
    }
  }
  // Boxed in: run off before the wind, the one heading every ship can always sail.
  return wrapAngle(w.windDirection);
};


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

export const engage = (me: Entity, c: CaptainState, t: Entity, w: World2D): GameCommand[] => {
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
  // Hold fire until within effective range (well inside the guns' reach): close first. The
  // doctrine of the flag sets the range, the target (hull or rigging) and the manoeuvres.
  const d = DOCTRINES[s.faction];
  const prefer = c.range * d.rangeFactor;
  const effective = Math.min(BROADSIDE_MAX, prefer * 1.6);
  const loadedInRange = range < effective && sideLoaded(s, c.side) > 0;
  const closeBias = range > effective * 0.9 && !loadedInRange ? 1.2 : loadedInRange ? 0 : Math.max(-0.5, Math.min(0.5, (range - prefer) / prefer)) * 0.8;
  // Out of effective range: a stern chase, bow on to the lead point, so the chase guns bear.
  const basic = range > effective * 1.05 ? brg : brg - abeam + (c.side === "starboard" ? closeBias : -closeBias);
  // In her leader's line of battle a ship keeps her station and fires as her guns bear.
  const station = lineStation(me, w.ships);
  const desired = station ? station.course : (tacticalHeading(me, t, d, w.windDirection, range, effective, loadedInRange) ?? basic);
  const cmds: GameCommand[] = [{ type: "course", ship: me.id, heading: clearHeading(me, sailableHeading(desired, w.windDirection, s, yawOf(me.body!.rot)), w) }];
  const level: SailLevel = station ? station.level : range > prefer * 1.4 ? 3 : 2;
  if (s.sailTarget[0] !== level) cmds.push({ type: "sails", ship: me.id, mast: "all", level });
  const want: AmmoId = firesAtRigging(d, t) && range > 100 && range < 360 && (s.stores.chain ?? 0) > 0 ? "chain" : chooseAmmo(s, t.ship!, range);
  if (s.ammoLoad.broadside !== want && sideLoaded(s, c.side) === 0) cmds.push({ type: "loadAmmo", ship: me.id, mount: "broadside", ammo: want });
  if (range < effective && Math.abs(wrapAngle(rel - abeam)) < ARC && sideLoaded(s, c.side) > 0) cmds.push({ type: "fire", ship: me.id, mount: "broadside", side: c.side, range: aimRange, bearing: brg, aimHeight: aimHeightFor(d, t) });
  // Special loads, as the player has them: Greek fire from the bow chaser at close quarters,
  // rockets from the swivels into the rigging at middle range.
  // With some hysteresis: a change of load costs a full reload.
  const fireNow = s.ammoLoad.bowChaser === "greekFire";
  const bowWant: AmmoId = range < (fireNow ? 95 : 60) && (s.stores.greekFire ?? 0) > 0 ? "greekFire" : "round";
  if (s.ammoLoad.bowChaser !== bowWant && s.model.guns.some((g) => g.kind === "bowChaser")) cmds.push({ type: "loadAmmo", ship: me.id, mount: "bowChaser", ammo: bowWant });
  const rocketsNow = s.ammoLoad.swivel === "rocket";
  const swivelWant: AmmoId = range > (rocketsNow ? 70 : 100) && range < (rocketsNow ? 220 : 190) && (s.stores.rocket ?? 0) > 0 ? "rocket" : "grape";
  if (s.ammoLoad.swivel !== swivelWant && s.model.guns.some((g) => g.kind === "swivel")) cmds.push({ type: "loadAmmo", ship: me.id, mount: "swivel", ammo: swivelWant });
  if (range < 420 && Math.abs(rel) < 0.18) cmds.push({ type: "fire", ship: me.id, mount: "bowChaser", range: aimRange, bearing: brg });
  if (range < 380 && Math.abs(wrapAngle(rel - Math.PI)) < 0.2) cmds.push({ type: "fire", ship: me.id, mount: "sternChaser", range: aimRange, bearing: brg });
  if (range > 150 && range < 750) cmds.push({ type: "fire", ship: me.id, mount: "mortar", range: aimRange, bearing: brg });
  if (range < (s.ammoLoad.swivel === "rocket" ? 200 : 120)) cmds.push({ type: "fire", ship: me.id, mount: "swivel", side: rel >= 0 ? "starboard" : "port", range });
  // Close aboard with a stronger crew: grapple and board (pirates love it).
  const boarders = d.boardRatio;
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
  c.wx = w.ports[k]!.ax;
  c.wz = w.ports[k]!.az;
};

/**
 * Station keeping in a convoy (Reynolds' leader following, "Steering Behaviors", 1999): steer for
 * a point astern and abeam of the leader, and match its canvas.
 */
const STATION_ASTERN = 140;
export const keepStation = (me: Entity, leader: Entity, w: Pick<World2D, "bed" | "windDirection">): GameCommand[] => {
  const b = me.body!;
  const lb = leader.body!;
  const lh = yawOf(lb.rot);
  const side = me.id % 2 === 0 ? 1 : -1;
  const sx = lb.pos.x - Math.sin(lh) * STATION_ASTERN + Math.cos(lh) * 60 * side;
  const sz = lb.pos.z - Math.cos(lh) * STATION_ASTERN - Math.sin(lh) * 60 * side;
  const gap = Math.hypot(sx - b.pos.x, sz - b.pos.z);
  // Close the gap at full sail, then hold station under the leader's canvas.
  const desired = gap > 40 ? Math.atan2(sx - b.pos.x, sz - b.pos.z) : lh;
  const level = (gap > 200 ? 3 : (leader.ship!.sailTarget[0] ?? 2)) as SailLevel;
  return [
    { type: "course", ship: me.id, heading: clearHeading(me, sailableHeading(desired, w.windDirection, me.ship!, yawOf(me.body!.rot)), w) },
    ...(me.ship!.sailTarget[0] !== level ? [{ type: "sails" as const, ship: me.id, mast: "all" as const, level }] : []),
  ];
};

const patrol = (me: Entity, c: CaptainState, w: World2D): GameCommand[] => {
  const b = me.body!;
  const leader = c.leader >= 0 ? w.ships.find((x) => x.id === c.leader && !x.ship!.sinking && !x.ship!.struck) : undefined;
  if (leader) return keepStation(me, leader, w);
  if (c.role === "trade" && (c.dest < 0 || Math.hypot(c.wx - b.pos.x, c.wz - b.pos.z) < 260)) nextPort(c, w);
  else if (Math.hypot(c.wx - b.pos.x, c.wz - b.pos.z) < 120) {
    c.wx = b.pos.x + (w.rng() - 0.5) * 1600;
    c.wz = b.pos.z + (w.rng() - 0.5) * 1600;
  }
  // Round the islands to the waypoint (a port behind an island is reached the long way).
  const next = wayPoint(me, c, w.bed);
  const desired = Math.atan2(next.x - b.pos.x, next.z - b.pos.z);
  // A convoy sails at the pace of its slowest ship: shorten sail while a follower lags.
  const lagging = w.ships.some((f) => f.captain?.leader === me.id && !f.ship!.sinking && Math.hypot(f.body!.pos.x - b.pos.x, f.body!.pos.z - b.pos.z) > 320);
  const level: SailLevel = lagging ? 1 : 3;
  return [
    { type: "course", ship: me.id, heading: clearHeading(me, sailableHeading(desired, w.windDirection, me.ship!, yawOf(me.body!.rot)), w) },
    ...(me.ship!.sailTarget[0] !== level ? [{ type: "sails" as const, ship: me.id, mast: "all" as const, level }] : []),
  ];
};

const flee = (me: Entity, t: Entity | null, w: World2D): GameCommand[] => {
  const b = me.body!;
  const away = t ? Math.atan2(b.pos.x - t.body!.pos.x, b.pos.z - t.body!.pos.z) : yawOf(b.rot);
  return [
    { type: "course", ship: me.id, heading: clearHeading(me, sailableHeading(away, w.windDirection, me.ship!, yawOf(me.body!.rot)), w) },
    { type: "sails", ship: me.id, mast: "all", level: 3 },
  ];
};

/** How far a navy captain looks for an enemy fort to attack, and the range he bombards it from. */
const FORT_SIGHT = 900;
const BOMBARD = 300;

const enemyFort = (me: Entity, w: World2D): Entity | null => {
  let best: Entity | null = null;
  let bestD = FORT_SIGHT;
  for (const f of w.forts) {
    const st = f.fort!;
    if (st.faction === me.ship!.faction || !isHostile(standing(me.ship!.faction, st.faction, w.relations))) continue;
    const d = Math.hypot(st.site.x - me.body!.pos.x, st.site.z - me.body!.pos.z);
    if (d < bestD) {
      bestD = d;
      best = f;
    }
  }
  return best;
};

/**
 * Siege: close to bombarding range, lie broadside on to the walls and fire whenever the guns
 * bear; once the fort is silenced, land a party if the crew outnumbers the garrison well.
 */
const bombard = (me: Entity, c: CaptainState, fe: Entity, w: World2D): GameCommand[] => {
  const s = me.ship!;
  const b = me.body!;
  const st = fe.fort!;
  const range = Math.hypot(st.site.x - b.pos.x, st.site.z - b.pos.z) - st.def.radius * 0.5;
  if (st.silenced) {
    if (range < st.def.radius + 150 && s.crew * 0.66 > st.garrison * 1.6) return [{ type: "assault", ship: me.id, fort: fe.id }];
    const brg = Math.atan2(st.site.x - b.pos.x, st.site.z - b.pos.z);
    return [{ type: "course", ship: me.id, heading: clearHeading(me, sailableHeading(brg, w.windDirection, s, yawOf(me.body!.rot)), w) }];
  }
  const heading = yawOf(b.rot);
  const brg = Math.atan2(st.site.x - b.pos.x, st.site.z - b.pos.z);
  const rel = relativeBearing(heading, b.pos.x, b.pos.z, st.site.x, st.site.z);
  c.side = rel >= 0 ? "starboard" : "port";
  const abeam = c.side === "starboard" ? Math.PI / 2 : -Math.PI / 2;
  const bias = Math.max(-0.6, Math.min(0.6, (range - BOMBARD) / BOMBARD)) * 0.9;
  const desired = range > BOMBARD * 1.5 ? brg : brg - abeam + (c.side === "starboard" ? bias : -bias);
  const cmds: GameCommand[] = [{ type: "course", ship: me.id, heading: clearHeading(me, sailableHeading(desired, w.windDirection, s, yawOf(me.body!.rot)), w) }];
  const level: SailLevel = range > BOMBARD * 1.5 ? 3 : 2;
  if (s.sailTarget[0] !== level) cmds.push({ type: "sails", ship: me.id, mast: "all", level });
  const aimHeight = st.site.y + st.def.height * 0.5;
  if (range < BROADSIDE_MAX && Math.abs(wrapAngle(rel - abeam)) < ARC && sideLoaded(s, c.side) > 0) cmds.push({ type: "fire", ship: me.id, mount: "broadside", side: c.side, range, bearing: brg, aimHeight });
  if (range > 150 && range < 750) cmds.push({ type: "fire", ship: me.id, mount: "mortar", range, bearing: brg, aimHeight });
  return cmds;
};

/** The player's ship, if a hunter can find her (hunters only chase hostile quarry). */
const quarry = (me: Entity, ships: readonly Entity[], rel: Relations | null): Entity | null => {
  const p = ships.find((o) => o.player && !o.ship!.sinking && hostileTo(me.ship!, o.ship!, rel));
  if (!p) return null;
  return Math.hypot(p.body!.pos.x - me.body!.pos.x, p.body!.pos.z - me.body!.pos.z) < HUNT_RANGE ? p : null;
};

/**
 * Her people's share at which a captain strikes, and below which he runs: ships of the age of sail
 * struck with a third or so of their people down, not fought on to the last tenth (at 0.15 and 0.3
 * the losers of the battle audit ended with 0-15 men of 110 and half their hull, beta test 19.11).
 */
const STRIKE_CREW = 0.3;
const FLEE_CREW = 0.45;

/** One decision of the captain; mutates its state and returns the commands it gives. */
export const decide = (me: Entity, c: CaptainState, w: World2D): GameCommand[] => {
  const s = me.ship!;
  if (c.mode === "struck") return [];
  const seen = (x: Entity): boolean => !smokeBetween(w.screens, me.body!.pos.x, me.body!.pos.z, x.body!.pos.x, x.body!.pos.z);
  const target = c.target === null ? null : (w.ships.find((x) => x.id === c.target && !x.ship!.sinking && !x.ship!.struck && seen(x)) ?? null);
  if (crewShare(s) < STRIKE_CREW || hullShare(s) < 0.15) {
    c.mode = "struck";
    s.struck = true;
    return [{ type: "sails", ship: me.id, mast: "all", level: 0 }];
  }
  // Disabled (core DISABLED): she cannot run; with an enemy close aboard and her people outnumbered, she strikes.
  const disabled = damageState(shipCondition(s)) === "disabled";
  if (disabled) {
    const foe = nearestHostile(me, w.ships, w.fog, w.relations, w.screens);
    const near = foe && Math.hypot(foe.body!.pos.x - me.body!.pos.x, foe.body!.pos.z - me.body!.pos.z) < DISABLED.strikeRange;
    // ...once she has bled for it: a ship crippled aloft with her hull and people whole fought on
    // (one salvo of chain made a sound schooner strike within two seconds, beta test 19.11).
    const bled = hullShare(s) < 0.8 || crewShare(s) < 0.8;
    if (foe && near && bled && s.crew * DISABLED.outnumbered < foe.ship!.crew) {
      c.mode = "struck";
      s.struck = true;
      return [{ type: "sails", ship: me.id, mast: "all", level: 0 }];
    }
  }
  if (!disabled && (crewShare(s) < FLEE_CREW || hullShare(s) < 0.3)) {
    c.mode = "flee";
    return flee(me, target, w);
  }
  // A ship of a squadron with no enemy of her own in sight takes her leader's (the line engages together).
  const leaderTarget = (): Entity | null => {
    const lead = c.leader >= 0 && c.role === "patrol" ? w.ships.find((x) => x.id === c.leader) : undefined;
    const id = lead?.captain?.mode === "engage" ? lead.captain.target : null;
    return id === null || id === undefined ? null : (w.ships.find((x) => x.id === id && !x.ship!.sinking && !x.ship!.struck) ?? null);
  };
  const t = target ?? nearestHostile(me, w.ships, w.fog, w.relations, w.screens) ?? (c.role === "hunt" ? quarry(me, w.ships, w.relations) : null) ?? leaderTarget();
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
    // A man-of-war with no ship to fight goes for an enemy fort in sight.
    const fort = c.role === "patrol" && c.leader < 0 ? enemyFort(me, w) : null;
    if (fort) {
      c.mode = "engage";
      return bombard(me, c, fort, w);
    }
    return patrol(me, c, w);
  }
  c.mode = "engage";
  return engage(me, c, t, w);
};

/** Forward speed of a ship (m/s), for tests and the HUD of enemies. */
export const forwardSpeed = (e: Entity): number => rotateInv(e.body!.rot, e.body!.vel).z;
