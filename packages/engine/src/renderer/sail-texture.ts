import { type FactionId } from "@broadside/sim";
import { createRng, hashString, range } from "@broadside/core";

/**
 * Sail cloth painted procedurally: vertical cloths with seams, a darker bolt rope at the edges,
 * reef bands, weathering blotches and the faction's emblem (the reference ship carries a sun
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

/** Paints one sail texture (`size` square) for a faction; `withEmblem` for the big tiers. */
export const paintSail = (ctx: SailPaint, size: number, faction: FactionId, withEmblem: boolean): void => {
  const rng = createRng(hashString(`sail-${faction}-${withEmblem}`));
  ctx.globalAlpha = 1;
  ctx.fillStyle = CANVAS;
  ctx.fillRect(0, 0, size, size);
  // Weathering: soft darker blotches.
  for (let i = 0; i < 40; i++) {
    ctx.globalAlpha = range(rng, 0.04, 0.12);
    ctx.fillStyle = "rgb(70,60,48)";
    ctx.beginPath();
    ctx.arc(range(rng, 0, size), range(rng, 0, size), range(rng, size * 0.03, size * 0.14), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = "rgb(90,80,64)";
  const cloths = 12;
  for (let i = 1; i < cloths; i++) ctx.fillRect((i / cloths) * size - 1, 0, 2, size);
  for (const v of [0.18, 0.3]) ctx.fillRect(0, v * size, size, 3);
  ctx.globalAlpha = 1;
  ctx.fillStyle = "rgb(60,50,40)";
  ctx.fillRect(0, 0, size, size * 0.03);
  ctx.fillRect(0, size * 0.97, size, size * 0.03);
  ctx.fillRect(0, 0, size * 0.02, size);
  ctx.fillRect(size * 0.98, 0, size * 0.02, size);
  // Patches.
  for (let i = 0; i < 3; i++) {
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "rgb(120,108,88)";
    ctx.fillRect(range(rng, 0.1, 0.8) * size, range(rng, 0.1, 0.8) * size, size * 0.08, size * 0.06);
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
