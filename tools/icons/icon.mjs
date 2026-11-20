/* global Buffer */
/**
 * The game's icon, drawn from code (no hand-made art, same result every run): a galleon's dark
 * silhouette against a low sun over the sea, in the game's sepia (the reference's backlit shots,
 * ref_020 and ref_090). One SVG on a 100-unit square, rendered by sharp to every size needed:
 * the web app manifest (192, 512, maskable 512 with the art inside the safe circle), the Apple
 * touch icon, the favicon, and Android's launcher icons (legacy square and round per density,
 * the adaptive icon's foreground layer at 108 dp, its background colour).
 *
 * Usage: node tools/icons/icon.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const sharp = require("sharp");
const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const app = join(root, "packages/app");
const res = join(app, "android/app/src/main/res");

/** Background colour of the adaptive icon (the dark sepia of the sky's top). */
export const BACKGROUND = "#1c140d";

/** Three masts, three tiers of square sail each, a bowsprit with its jib, a high stern castle. */
const ship = () => {
  const masts = [
    { x: 40, top: 20, scale: 0.9 },
    { x: 52, top: 15, scale: 1 },
    { x: 64, top: 22, scale: 0.85 },
  ];
  const sails = masts
    .map(({ x, top, scale }) => {
      const tiers = [
        [top + 26 * scale, top + 39 * scale, 8 * scale, 7 * scale],
        [top + 14 * scale, top + 24 * scale, 6.5 * scale, 5.5 * scale],
        [top + 4 * scale, top + 12 * scale, 4.5 * scale, 4 * scale],
      ];
      const cloth = tiers.map(([y0, y1, w0, w1]) => `<path d="M${x - w1} ${y0} L${x + w1} ${y0} Q${x + w0 + 1} ${(y0 + y1) / 2} ${x + w0} ${y1} L${x - w0} ${y1} Q${x - w0 - 1} ${(y0 + y1) / 2} ${x - w1} ${y0} Z"/>`).join("");
      return `<rect x="${x - 0.7}" y="${top}" width="1.4" height="${62 - top}"/>${cloth}`;
    })
    .join("");
  return `<g fill="#120c07">
    ${sails}
    <path d="M76 60 L91 49 L91.8 50.2 L77.5 61.5 Z"/>
    <path d="M78 58 L90 50 L84 60 Z"/>
    <path d="M20 52 L33 52 L33 58 L80 58 L82 60 L74 71 Q52 74 30 71 L22 66 Z"/>
    <rect x="21" y="49" width="10" height="3"/>
  </g>`;
};

/** The whole picture; `pad` shrinks it into the middle (the maskable and adaptive safe zones). */
const svg = (size, { pad = 0, round = false } = {}) => {
  const s = 100 - pad * 2;
  const art = `<g transform="translate(${pad} ${pad}) scale(${s / 100})">
      <rect width="100" height="100" fill="url(#sky)"/>
      <circle cx="50" cy="50" r="40" fill="url(#glow)"/>
      <circle cx="50" cy="50" r="8" fill="#fff4dc"/>
      <rect y="64" width="100" height="36" fill="url(#sea)"/>
      <path d="M44 66 L56 66 L64 100 L36 100 Z" fill="url(#path)" opacity="0.8"/>
      ${ship()}
    </g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${BACKGROUND}"/><stop offset="0.55" stop-color="#6b5136"/><stop offset="0.64" stop-color="#c9a36e"/></linearGradient>
      <radialGradient id="glow"><stop offset="0" stop-color="#ffe9bf" stop-opacity="0.95"/><stop offset="0.35" stop-color="#e8c58e" stop-opacity="0.55"/><stop offset="1" stop-color="#c9a36e" stop-opacity="0"/></radialGradient>
      <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a2b1c"/><stop offset="1" stop-color="#0d0905"/></linearGradient>
      <linearGradient id="path" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe2a8"/><stop offset="1" stop-color="#ffe2a8" stop-opacity="0"/></linearGradient>
      <clipPath id="circle"><circle cx="50" cy="50" r="50"/></clipPath>
    </defs>
    ${round ? `<g clip-path="url(#circle)">${art}</g>` : art}
  </svg>`;
};

const png = async (file, size, opts) => {
  mkdirSync(dirname(file), { recursive: true });
  await sharp(Buffer.from(svg(size, opts))).png().toFile(file);
};

// Web app manifest and browser icons. Maskable: the art within the central 80% (the safe circle).
await png(join(app, "public/icons/icon-192.png"), 192);
await png(join(app, "public/icons/icon-512.png"), 512);
await png(join(app, "public/icons/icon-maskable-512.png"), 512, { pad: 0 });
await png(join(app, "public/icons/apple-touch-icon.png"), 180);
await png(join(app, "public/icons/favicon-32.png"), 32);
// Android launcher icons: legacy square and round per density, the adaptive foreground at 108 dp
// with the art in its inner 72 dp (Android masks the rest).
const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, k] of Object.entries(densities)) {
  await png(join(res, `mipmap-${d}/ic_launcher.png`), 48 * k);
  await png(join(res, `mipmap-${d}/ic_launcher_round.png`), 48 * k, { round: true });
  await png(join(res, `mipmap-${d}/ic_launcher_foreground.png`), 108 * k, { pad: 0 });
}
writeFileSync(join(res, "values/ic_launcher_background.xml"), `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${BACKGROUND}</color>\n</resources>\n`);
console.log("icons written");
