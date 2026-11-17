import { type ShroudLadder } from "./rig-layout";

/**
 * Men going aloft (pure, tested): the way from the deck up a shroud's ratlines and over the rim of
 * the top, and where on it a man is after `u` seconds of climbing. The clips are Mixamo's ladder
 * climb and climb-to-top, retargeted onto the figures (tools/assets/retarget.mjs), which bakes the
 * ladder climb in place and gives its travel: the man's root moves up the ratlines at
 * `rise / seconds` and the clip's frame is read from the same `u`, so hands and feet keep step
 * with the climb (root motion driven by the game, as in Unreal's "in place" locomotion), and
 * climbing down is the same clip played back. A man leans with the shroud (the ratlines slope in
 * to the mast head), facing in board as a man on a ladder faces the wall.
 */
export type V3 = readonly [number, number, number];

/** Travel of a climbing clip (crew-anim header). */
export interface ClimbClip {
  readonly seconds: number;
  readonly frames: number;
  /** Rise and forward travel over the clip; how far before the man his hands work. */
  readonly rise: number;
  readonly advance: number;
  readonly reach: number;
}

export interface AloftRoute {
  /** Where he stands on deck, waiting, and which way he faces there. */
  readonly deck: V3;
  readonly deckYaw: number;
  /** The ratlines (midway between the middle two shrouds) at the foot and the head. */
  readonly foot: V3;
  readonly head: V3;
  /** Where he stands in the top. */
  readonly top: V3;
}

export interface AloftPose {
  readonly at: V3;
  readonly yaw: number;
  /** Forward tilt about the man's right (radians), the top of him towards where he faces. */
  readonly lean: number;
  readonly clip: "idle" | "climb" | "mount";
  /** Frame of the clip (climb and mount); idle plays on its own. */
  readonly frame: number;
}

const mid = (a: V3, b: V3): V3 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];

/** The way up one gang of shrouds to a top at height `topY` (station `topZ`). */
export const aloftRoute = (l: ShroudLadder, deck: V3, topY: number, topZ: number): AloftRoute => {
  const s = l.shrouds;
  const foot = mid(s[1]!.foot, s[2]!.foot);
  const head = mid(s[1]!.head, s[2]!.head);
  return { deck, deckYaw: l.side > 0 ? Math.PI / 2 : -Math.PI / 2, foot, head, top: [l.side * 0.75, topY, topZ + 0.3] };
};

interface Climb {
  readonly yaw: number;
  readonly lean: number;
  /** Seconds on the ratlines, then over the rim. */
  readonly ladder: number;
  readonly total: number;
  readonly end: V3;
}

const climbOf = (r: AloftRoute, climb: ClimbClip, mount: ClimbClip): Climb => {
  const d = [r.head[0] - r.foot[0], r.head[1] - r.foot[1], r.head[2] - r.foot[2]] as const;
  const flat = Math.hypot(d[0], d[2]);
  const yaw = Math.atan2(d[0], d[2]);
  const lean = Math.atan2(flat, d[1]);
  // Up the ratlines to where the climb over the rim, rising its own height, lands on the top.
  const endY = Math.max(r.foot[1], Math.min(r.head[1], r.top[1] - mount.rise));
  const k = (endY - r.foot[1]) / Math.max(1e-6, d[1]);
  const ladder = (endY - r.foot[1]) / (climb.rise / climb.seconds);
  return { yaw, lean, ladder, total: ladder + mount.seconds, end: [r.foot[0] + d[0] * k, endY, r.foot[2] + d[2] * k] };
};

/** Seconds from the deck to standing in the top. */
export const aloftSeconds = (r: AloftRoute, climb: ClimbClip, mount: ClimbClip): number => climbOf(r, climb, mount).total;

/** A man `u` seconds up the way (0: on deck; `aloftSeconds`: in the top). */
export const aloftPose = (r: AloftRoute, climb: ClimbClip, mount: ClimbClip, u: number): AloftPose => {
  const c = climbOf(r, climb, mount);
  if (u <= 0) return { at: r.deck, yaw: r.deckYaw, lean: 0, clip: "idle", frame: 0 };
  if (u >= c.total) return { at: r.top, yaw: c.yaw, lean: 0, clip: "idle", frame: 0 };
  const fx = Math.sin(c.yaw);
  const fz = Math.cos(c.yaw);
  // Where his root stands: back from the rung his hands are on, along his tilted forward.
  const back = (p: V3, lean: number, reach: number): V3 => [p[0] - fx * Math.cos(lean) * reach, p[1] + Math.sin(lean) * reach, p[2] - fz * Math.cos(lean) * reach];
  if (u < c.ladder) {
    const k = u / c.ladder;
    const rung: V3 = [r.foot[0] + (c.end[0] - r.foot[0]) * k, r.foot[1] + (c.end[1] - r.foot[1]) * k, r.foot[2] + (c.end[2] - r.foot[2]) * k];
    const phase = (u / climb.seconds) % 1;
    return { at: back(rung, c.lean, climb.reach), yaw: c.yaw, lean: c.lean, clip: "climb", frame: Math.min(climb.frames - 1, Math.floor(phase * climb.frames)) };
  }
  // Over the rim: the clip carries him up and forward; the root drifts so that he lands at his
  // place in the top, and straightens from the shroud's slope.
  const m = (u - c.ladder) / mount.seconds;
  const start = back(c.end, c.lean, climb.reach);
  const land: V3 = [start[0] + fx * mount.advance, start[1] + mount.rise, start[2] + fz * mount.advance];
  const at: V3 = [start[0] + (r.top[0] - land[0]) * m, start[1] + (r.top[1] - land[1]) * m, start[2] + (r.top[2] - land[2]) * m];
  return { at, yaw: c.yaw, lean: c.lean * (1 - m), clip: "mount", frame: Math.min(mount.frames - 1, Math.floor(m * mount.frames)) };
};
