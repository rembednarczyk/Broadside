#!/usr/bin/env node
/**
 * Textures from Poly Haven (CC0), as podrcr takes them: downloads the 2k JPG maps of each listed
 * asset into .asset-cache/polyhaven (outside git) and writes game-sized JPGs to
 * packages/app/public/assets/textures/<id>_<map>.jpg (and a smaller <id>_<map>-lite.jpg).
 *
 * Usage: node tools/assets/textures.mjs [id ...]
 */
import { execFileSync } from "node:child_process";
import { access, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Buffer } from "node:buffer";
import process from "node:process";
import sharp from "sharp";

const API = "https://api.polyhaven.com";
const CACHE = ".asset-cache/polyhaven";
const OUT = "packages/app/public/assets/textures";

/**
 * Asset id, and the side in pixels of each map (diff: colour, nor_gl: OpenGL normal map). Each map
 * is also written at a quarter of the area (`-lite`, half the side, at least 512) for the low preset.
 */
const TEXTURES = [
  // Deck planking of the generated hulls.
  { id: "weathered_planks", maps: { diff: 2048, nor_gl: 2048 } },
  // Masts, yards and carriages: dark, tarred timber.
  { id: "dark_planks", maps: { diff: 1024, nor_gl: 1024 } },
  // Sailcloth: the weave, packed as a detail map over the painted canvas (see detailMap below).
  { id: "rough_linen", maps: { diff: 1024, nor_gl: 1024 }, detail: true },
  // Island terrain (terrain-splat.ts): cliff faces, the tops seen from above, the beaches.
  { id: "rock_face", maps: { diff: 1024 } },
  { id: "aerial_grass_rock", maps: { diff: 1024 } },
  { id: "sandy_gravel_02", maps: { diff: 1024 } },
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
    // A detail asset ships only as its packed map (below).
    if (t.detail) continue;
    const out = join(OUT, `${t.id}_${map}.jpg`);
    await sharp(raw).resize(size, size).jpeg({ quality: 88 }).toFile(out);
    const lite = Math.max(512, size / 2);
    await sharp(raw).resize(lite, lite).jpeg({ quality: 85 }).toFile(join(OUT, `${t.id}_${map}-lite.jpg`));
    console.log(out);
  }
  if (t.detail) {
    // Babylon's detail-map packing: R grey albedo (0.5 leaves the colour alone), G normal Y,
    // B roughness (unused: mid), A normal X. The grey is the cloth's luminance about its own mean.
    for (const [suffix, size] of [["", t.maps.diff], ["-lite", Math.max(512, t.maps.diff / 2)]]) {
      const grey = await sharp(join(CACHE, `${t.id}_diff.jpg`)).resize(size, size).greyscale().normalise().linear(0.6, 51).raw().toBuffer();
      const nor = await sharp(join(CACHE, `${t.id}_nor_gl.jpg`)).resize(size, size).removeAlpha().raw().toBuffer();
      const rgba = Buffer.alloc(size * size * 4);
      for (let i = 0; i < size * size; i++) rgba.set([grey[i], nor[i * 3 + 1], 128, nor[i * 3]], i * 4);
      const out = join(OUT, `${t.id}_detail${suffix}.png`);
      await sharp(rgba, { raw: { width: size, height: size, channels: 4 } }).png({ compressionLevel: 9 }).toFile(out);
      console.log(out);
    }
  }
}
