/**
 * Recoil of a carriage gun (view only), the sequence of the period drill: the gun leaps back
 * against its breeching rope (a fraction of a second), stays inboard while it is sponged and
 * loaded, then is run out again on its tackles. A fixed sequence in time since the shot (keyframes,
 * eased), with no physics of its own: the simulation already applies the recoil to the ship.
 */
/** Seconds: the leap inboard, the time held inboard, the run out. */
const LEAP = 0.12;
const HELD = 2.2;
const RUN_OUT = 1.6;
/** Total length of the sequence (s). */
export const RECOIL_TIME = LEAP + HELD + RUN_OUT;

/** Share 0..1 of the full recoil travel at `t` seconds after the shot. */
export const recoilShare = (t: number): number => {
  if (t < 0 || t >= RECOIL_TIME) return 0;
  // Ease out: the breeching takes the gun up hard at the end of its travel.
  if (t < LEAP) return 1 - (1 - t / LEAP) ** 2;
  if (t < LEAP + HELD) return 1;
  const u = (t - LEAP - HELD) / RUN_OUT;
  // Hauled out by hand: a smooth start and stop (smoothstep).
  return 1 - u * u * (3 - 2 * u);
};
