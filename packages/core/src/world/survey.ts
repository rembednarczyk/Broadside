import { type Archipelago } from "./archipelago";

/**
 * The sea as the player has seen it (the chart's fog of war: what lies beyond the waters sailed
 * is blank until a lookout has had it in sight, as on the charts of the period). The sea's square
 * is cut into SURVEY.cell squares; a cell is surveyed once its centre has been within
 * SURVEY.sight of the player's ship (a masthead lookout sees land some kilometres off).
 */
export const SURVEY = {
  /** Side of a survey cell (m). */
  cell: 250,
  /** How far the lookout charts the sea and its shores (m). */
  sight: 1200,
  /** How often the lookout's sweep is taken (s). */
  every: 1,
} as const;

/**
 * How far the lookout sees in a fog of the given thickness (0 clear .. 1 thick): the sight cut
 * by up to 70%, the same rule the AI captains spot an enemy by (sim captain, DETECT).
 */
export const lookoutRange = (fog: number): number => SURVEY.sight * (1 - 0.7 * Math.min(1, Math.max(0, fog)));

/** Cells per side of the sea's square. */
export const surveySide = (a: Archipelago): number => Math.ceil((2 * a.half) / SURVEY.cell);

/** The cell holding a point, or -1 outside the sea's square. */
export const surveyIndex = (a: Archipelago, x: number, z: number): number => {
  const n = surveySide(a);
  const i = Math.floor((x + a.half) / SURVEY.cell);
  const j = Math.floor((z + a.half) / SURVEY.cell);
  return i < 0 || j < 0 || i >= n || j >= n ? -1 : j * n + i;
};

/** Centre of a cell (world metres). */
export const surveyCentre = (a: Archipelago, index: number): { x: number; z: number } => {
  const n = surveySide(a);
  return { x: -a.half + ((index % n) + 0.5) * SURVEY.cell, z: -a.half + (Math.floor(index / n) + 0.5) * SURVEY.cell };
};

/** The cells whose centres lie within `r` of (x, z), in index order. */
export const cellsInSight = (a: Archipelago, x: number, z: number, r: number): number[] => {
  const n = surveySide(a);
  const out: number[] = [];
  const lo = (v: number) => Math.max(0, Math.floor((v - r + a.half) / SURVEY.cell));
  const hi = (v: number) => Math.min(n - 1, Math.floor((v + r + a.half) / SURVEY.cell));
  for (let j = lo(z); j <= hi(z); j++) {
    for (let i = lo(x); i <= hi(x); i++) {
      const c = surveyCentre(a, j * n + i);
      if (Math.hypot(c.x - x, c.z - z) <= r) out.push(j * n + i);
    }
  }
  return out;
};
