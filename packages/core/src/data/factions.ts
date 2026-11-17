/**
 * Factions and their standing towards each other at the start of a game (Type Object). The
 * player's standing moves with reputation (M4); nations at war fight on sight, pirates fight all.
 */
export type Faction = "player" | "crown" | "republic" | "empire" | "pirates";
export const FACTIONS: readonly Faction[] = ["player", "crown", "republic", "empire", "pirates"];

/** Standing -1 (war) .. 1 (allied). Symmetric. */
const START: Readonly<Record<string, number>> = {
  "crown|republic": -1,
  "crown|empire": 0,
  "republic|empire": -0.5,
  "player|crown": 0,
  "player|republic": 0,
  "player|empire": 0,
};

const key = (a: Faction, b: Faction): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

export const startStanding = (a: Faction, b: Faction): number => {
  if (a === b) return 1;
  if (a === "pirates" || b === "pirates") return -1;
  return START[key(a, b)] ?? 0;
};

/** Ships fire on each other at or below this standing. */
export const HOSTILE = -0.5;
export const isHostile = (standing: number): boolean => standing <= HOSTILE;
