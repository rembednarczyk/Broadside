import { type FactionId } from "@broadside/sim";
import { createRng, hashString, range } from "@broadside/core";

/**
 * Sail cloth painted procedurally: vertical cloths of uneven shade sewn with stitched flat seams,
 * tabling and bolt rope at the edges, reef bands with their points, rain streaks, stitched patches,
 * weathering blotches and the faction's emblem (the reference ship carries a sun
 * emblem). Expressed as drawing operations replayed on a canvas (testable without one).
 */
export interface SailPaint {
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  globalAlpha: number;
  fillRect(x: number, y: number, w: number, h: number): void;
  beginPath(): void;
  arc(x: number, y: number, r: number, a0: number, a1: number): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  closePath(): void;
  fill(): void;
  stroke(): void;
}

const CANVAS = "rgb(112,101,85)";

const emblem = (ctx: SailPaint, f: FactionId, cx: number, cy: number, r: number): void => {
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = "rgb(40,30,22)";
  ctx.fillStyle = "rgb(40,30,22)";
  ctx.lineWidth = r * 0.08;
  if (f === "player" || f === "empire") {
    // Sun and compass rose: a ring, rays and a centre disc.
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const len = i % 2 === 0 ? r : r * 0.78;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r * 0.3, cy + Math.sin(a) * r * 0.3);
      ctx.lineTo(cx + Math.cos(a + 0.12) * r * 0.62, cy + Math.sin(a + 0.12) * r * 0.62);
      ctx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
      ctx.lineTo(cx + Math.cos(a - 0.12) * r * 0.62, cy + Math.sin(a - 0.12) * r * 0.62);
      ctx.closePath();
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.25, 0, Math.PI * 2);
    ctx.fill();
  } else if (f === "crown") {
    ctx.fillStyle = "rgb(120,30,24)";
    ctx.fillRect(cx - r * 0.15, cy - r, r * 0.3, r * 2);
    ctx.fillRect(cx - r, cy - r * 0.15, r * 2, r * 0.3);
  } else if (f === "republic") {
    ctx.fillStyle = "rgb(30,45,90)";
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
      const rr = i % 2 === 0 ? r : r * 0.42;
      if (i === 0) ctx.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      else ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
  } else {
    // Pirates: a skull and crossed bones.
    ctx.fillStyle = "rgb(20,16,14)";
    ctx.beginPath();
    ctx.arc(cx, cy - r * 0.2, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(cx - r * 0.25, cy + r * 0.1, r * 0.5, r * 0.35);
    ctx.lineWidth = r * 0.16;
    ctx.strokeStyle = "rgb(20,16,14)";
    ctx.beginPath();
    ctx.moveTo(cx - r, cy + r * 0.2);
    ctx.lineTo(cx + r, cy + r * 0.9);
    ctx.moveTo(cx + r, cy + r * 0.2);
    ctx.lineTo(cx - r, cy + r * 0.9);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
};

/**
 * How a sail is made, as the sailmaker lays it out (shared by the painted texture and, later, the
 * cloth's physics): vertical cloths (bolts of canvas about 24 inches wide) sewn edge to edge with
 * flat seams, the edges turned and sewn as tabling with the bolt rope on them, and reef bands
 * (doubled strips across the sail) carrying the reef points. Positions in shares of the sail.
 */
export const SAIL_LAYOUT = {
  /** Number of cloths across the sail. */
  cloths: 12,
  /** Reef bands, as heights from the head (0) to the foot (1). */
  reefBands: [0.18, 0.3],
  /** Width of the tabling at the edges. */
  tabling: 0.025,
} as const;

/** Paints one sail texture (`size` square) for a faction; `withEmblem` for the big tiers. */
export const paintSail = (ctx: SailPaint, size: number, faction: FactionId, withEmblem: boolean): void => {
  const rng = createRng(hashString(`sail-${faction}-${withEmblem}`));
  // Stroke widths are given for a 512 px texture and scale with the size.
  const px = size / 512;
  const { cloths, reefBands, tabling } = SAIL_LAYOUT;
  ctx.globalAlpha = 1;
  ctx.fillStyle = CANVAS;
  ctx.fillRect(0, 0, size, size);
  // Each cloth is a bolt of its own: a slightly different shade, as canvas weathers unevenly.
  for (let i = 0; i < cloths; i++) {
    const lighter = rng.next() < 0.5;
    ctx.globalAlpha = range(rng, 0.03, 0.12);
    ctx.fillStyle = lighter ? "rgb(150,138,118)" : "rgb(72,62,50)";
    ctx.fillRect((i / cloths) * size, 0, size / cloths, size);
  }
  // Weathering: soft darker blotches.
  for (let i = 0; i < 40; i++) {
    ctx.globalAlpha = range(rng, 0.04, 0.12);
    ctx.fillStyle = "rgb(70,60,48)";
    ctx.beginPath();
    ctx.arc(range(rng, 0, size), range(rng, 0, size), range(rng, size * 0.03, size * 0.14), 0, Math.PI * 2);
    ctx.fill();
  }
  // Rain streaks: thin darker runs down the cloth from the head and the reef bands.
  for (let i = 0; i < 70; i++) {
    ctx.globalAlpha = range(rng, 0.03, 0.09);
    ctx.fillStyle = "rgb(60,52,42)";
    const top = rng.next() < 0.5 ? 0 : reefBands[i % reefBands.length]! * size;
    ctx.fillRect(range(rng, 0, size), top, range(rng, 1, 3) * px, range(rng, 0.08, 0.5) * size);
  }
  // Flat seams between the cloths: the overlap reads darker, with a row of stitches on each edge.
  for (let i = 1; i < cloths; i++) {
    const x = (i / cloths) * size;
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = "rgb(84,74,60)";
    ctx.fillRect(x - 2.5 * px, 0, 5 * px, size);
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = "rgb(58,49,39)";
    for (const dx of [-2.5, 2.5]) for (let y = 0; y < size; y += 6 * px) ctx.fillRect(x + dx * px - 0.5 * px, y, px, 3.5 * px);
  }
  // Reef bands: a doubled strip sewn across, and the reef points hanging from it.
  for (const v of reefBands) {
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = "rgb(88,78,62)";
    ctx.fillRect(0, v * size - 4 * px, size, 8 * px);
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = "rgb(58,49,39)";
    for (const dy of [-4, 4]) for (let x = 0; x < size; x += 6 * px) ctx.fillRect(x, v * size + dy * px - 0.5 * px, 3.5 * px, px);
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = "rgb(48,40,32)";
    for (let i = 0; i < cloths; i++) ctx.fillRect(((i + 0.5) / cloths) * size - px, v * size, 2 * px, range(rng, 16, 24) * px);
  }
  // Tabling and bolt rope at the edges, stitched on the inside.
  ctx.globalAlpha = 1;
  ctx.fillStyle = "rgb(60,50,40)";
  const t = size * tabling;
  ctx.fillRect(0, 0, size, t);
  ctx.fillRect(0, size - t, size, t);
  ctx.fillRect(0, 0, t * 0.7, size);
  ctx.fillRect(size - t * 0.7, 0, t * 0.7, size);
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = "rgb(140,128,108)";
  for (let x = t; x < size - t; x += 7 * px) {
    ctx.fillRect(x, t + 2 * px, 4 * px, px);
    ctx.fillRect(x, size - t - 3 * px, 4 * px, px);
  }
  // Patches, each with its stitched border.
  for (let i = 0; i < 4; i++) {
    const x = range(rng, 0.1, 0.8) * size;
    const y = range(rng, 0.1, 0.8) * size;
    const w = range(rng, 0.05, 0.1) * size;
    const h = range(rng, 0.04, 0.08) * size;
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = rng.next() < 0.5 ? "rgb(128,116,96)" : "rgb(84,74,60)";
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = "rgb(52,44,35)";
    for (let k = 0; k < w; k += 6 * px) {
      ctx.fillRect(x + k, y + px, 3.5 * px, px);
      ctx.fillRect(x + k, y + h - 2 * px, 3.5 * px, px);
    }
    for (let k = 0; k < h; k += 6 * px) {
      ctx.fillRect(x + px, y + k, px, 3.5 * px);
      ctx.fillRect(x + w - 2 * px, y + k, px, 3.5 * px);
    }
  }
  ctx.globalAlpha = 1;
  if (withEmblem) emblem(ctx, faction, size / 2, size * 0.52, size * 0.3);
};

/**
 * Glow map of an emblem sail: lanterns hung behind the canvas light the emblem from within at
 * night (reference s. 11-13). Black everywhere but a soft warm disc behind the emblem.
 */
export const paintSailGlow = (ctx: SailPaint & { createRadialGradient?: unknown }, size: number): void => {
  ctx.globalAlpha = 1;
  ctx.fillStyle = "rgb(0,0,0)";
  ctx.fillRect(0, 0, size, size);
  for (let r = 10; r > 0; r--) {
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = "rgb(255,170,70)";
    ctx.beginPath();
    ctx.arc(size / 2, size * 0.52, (size * 0.32 * r) / 10, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
};
