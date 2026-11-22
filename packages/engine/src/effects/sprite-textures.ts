import { DynamicTexture, type Scene } from "../babylon";
import { billowBlobs } from "./billow";

/**
 * Particle sprites drawn procedurally (no downloaded textures, decision 16.11): a soft puff for
 * smoke and spray, a hot core for flashes and flames, a streak for rain, a splinter shard and a canvas
 * rag (filled polygons). Generated once per scene.
 */
export interface Sprites {
  readonly puff: DynamicTexture;
  readonly flare: DynamicTexture;
  readonly streak: DynamicTexture;
  /** A splinter: a long shard tapering to points, ragged along one side (stretched along its flight). */
  readonly shard: DynamicTexture;
  /** A torn scrap of canvas: an irregular four-sided rag. */
  readonly rag: DynamicTexture;
  /** Powder-smoke billows: a 2 × 2 atlas of seeded cauliflower puffs, lit from above (billow.ts). */
  readonly billow: DynamicTexture;
}

/** Cells per side of the billow atlas, and the pixel size of one cell. */
export const BILLOW_CELLS = 2;
export const BILLOW_CELL = 128;

const billowAtlas = (scene: Scene): DynamicTexture => {
  const size = BILLOW_CELL * BILLOW_CELLS;
  const t = new DynamicTexture("fx-billow", { width: size, height: size }, scene, true);
  const ctx = t.getContext() as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, size, size);
  for (let cell = 0; cell < BILLOW_CELLS * BILLOW_CELLS; cell++) {
    const ox = (cell % BILLOW_CELLS) * BILLOW_CELL;
    const oy = Math.floor(cell / BILLOW_CELLS) * BILLOW_CELL;
    for (const b of billowBlobs(11 + cell)) {
      const x = ox + b.x * BILLOW_CELL;
      const y = oy + b.y * BILLOW_CELL;
      const r = b.r * BILLOW_CELL;
      const v = Math.round(255 * b.shade);
      const g = ctx.createRadialGradient(x, y - r * 0.25, 0, x, y, r);
      g.addColorStop(0, `rgba(${v},${v},${v},0.55)`);
      g.addColorStop(0.6, `rgba(${v},${v},${v},0.38)`);
      g.addColorStop(1, `rgba(${v},${v},${v},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }
  t.hasAlpha = true;
  t.update();
  return t;
};

const polygon = (scene: Scene, name: string, points: readonly (readonly [number, number])[], size = 32): DynamicTexture => {
  const t = new DynamicTexture(name, { width: size, height: size }, scene, false);
  const ctx = t.getContext() as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = "rgba(255,255,255,1)";
  ctx.beginPath();
  points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x * size, y * size) : ctx.lineTo(x * size, y * size)));
  ctx.closePath();
  ctx.fill();
  t.hasAlpha = true;
  t.update();
  return t;
};

const radial = (scene: Scene, name: string, stops: [number, string][], size = 64): DynamicTexture => {
  const t = new DynamicTexture(name, { width: size, height: size }, scene, false);
  const ctx = t.getContext() as CanvasRenderingContext2D;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  t.hasAlpha = true;
  t.update();
  return t;
};

export const createSprites = (scene: Scene): Sprites => {
  const puff = radial(scene, "fx-puff", [[0, "rgba(255,255,255,0.9)"], [0.45, "rgba(255,255,255,0.45)"], [1, "rgba(255,255,255,0)"]]);
  const flare = radial(scene, "fx-flare", [[0, "rgba(255,255,255,1)"], [0.25, "rgba(255,230,160,0.9)"], [1, "rgba(255,120,20,0)"]]);
  const streak = new DynamicTexture("fx-streak", { width: 32, height: 32 }, scene, false);
  const ctx = streak.getContext() as CanvasRenderingContext2D;
  ctx.fillStyle = "rgba(255,255,255,1)";
  ctx.fillRect(13, 2, 6, 28);
  streak.hasAlpha = true;
  streak.update();
  const shard = polygon(scene, "fx-shard", [[0.5, 0.02], [0.6, 0.3], [0.58, 0.55], [0.64, 0.8], [0.5, 0.98], [0.42, 0.7], [0.45, 0.45], [0.38, 0.2]]);
  const rag = polygon(scene, "fx-rag", [[0.12, 0.2], [0.55, 0.08], [0.9, 0.3], [0.78, 0.62], [0.86, 0.9], [0.4, 0.82], [0.18, 0.92], [0.24, 0.55]]);
  return { puff, flare, streak, shard, rag, billow: billowAtlas(scene) };
};
