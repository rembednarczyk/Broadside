#!/usr/bin/env node
/**
 * Textures from Poly Haven (CC0), as podrcr takes them: downloads the 2k JPG maps of each listed
 * asset into .asset-cache/polyhaven (outside git) and writes game-sized JPGs to
 * packages/app/public/assets/textures/<id>_<map>.jpg.
 *
 * Usage: node tools/assets/textures.mjs [id ...]
 */
import { execFileSync } from "node:child_process";
import { access, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import process from "node:process";
import sharp from "sharp";

const API = "https://api.polyhaven.com";
const CACHE = ".asset-cache/polyhaven";
const OUT = "packages/app/public/assets/textures";

/** Asset id, and the side in pixels of each map (diff: colour, nor_gl: OpenGL normal map). */
const TEXTURES = [
  // Deck planking of the generated hulls.
  { id: "weathered_planks", maps: { diff: 1024, nor_gl: 1024 } },
  // Masts, yards and carriages: dark, tarred timber.
  { id: "dark_planks", maps: { diff: 512, nor_gl: 512 } },
  // Sailcloth: only the weave, as a normal map over the painted canvas.
  { id: "rough_linen", maps: { nor_gl: 512 } },
];
const KEY = { diff: "Diffuse", nor_gl: "nor_gl" };

const exists = (path) => access(path).then(() => true, () => false);
// curl, not fetch: it follows the session's HTTPS proxy settings.
const curl = (url, ...args) => execFileSync("curl", ["-sSfL", "--max-time", "120", ...args, url], { maxBuffer: 1 << 26 });
const download = async (url, path) => {
  if (await exists(path)) return path;
  await mkdir(dirname(path), { recursive: true });
  curl(url, "-o", path);
  return path;
};

const only = process.argv.slice(2);
await mkdir(OUT, { recursive: true });
for (const t of TEXTURES.filter((x) => only.length === 0 || only.includes(x.id))) {
  const files = JSON.parse(curl(`${API}/files/${t.id}`).toString("utf8"));
  for (const [map, size] of Object.entries(t.maps)) {
    const raw = await download(files[KEY[map]]["2k"].jpg.url, join(CACHE, `${t.id}_${map}.jpg`));
    const out = join(OUT, `${t.id}_${map}.jpg`);
    await sharp(raw).resize(size, size).jpeg({ quality: 85 }).toFile(out);
    console.log(out);
  }
}
