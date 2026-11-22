/**
 * The day's clock and its darkness, shared by the simulation (a lookout sees less at night) and
 * the renderer's sky. An hour of game time passes in four real minutes (provisions: a day is 96
 * minutes). Darkness is a linear ramp over civil twilight (dusk 18–20 h, dawn 5–7 h), the same
 * hours the sky darkens over.
 */
export const SECONDS_PER_HOUR = 240;

export const darkness = (hours: number): number => {
  const h = ((hours % 24) + 24) % 24;
  if (h >= 7 && h <= 18) return 0;
  if (h >= 20 || h <= 5) return 1;
  return h > 12 ? (h - 18) / 2 : (7 - h) / 2;
};

/** Share of a lookout's day range left in fog (0..1) and darkness (0..1): fog takes up to 70%, night 40%. */
export const sightShare = (fog: number, dark: number): number => (1 - 0.7 * Math.min(1, Math.max(0, fog))) * (1 - 0.4 * Math.min(1, Math.max(0, dark)));
