#!/usr/bin/env node
/**
 * Comparison sheets: for each scene of the reference clip (tools/shots/reference-scenes.json) a
 * shot of the game from the matching camera, hour and weather, set beside the clip's frame. The
 * sheets are the gate for visual work (decyzje 17.11, M9): look at the pair, not at the game alone.
 *
 * Usage: node tools/shots/reference-sheet.mjs <out-dir> [scene ...]
 * Writes <out-dir>/<scene>.jpg (game left, reference right).
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { URL, fileURLToPath } from "node:url";
import sharp from "sharp";

const [out, ...only] = process.argv.slice(2);
if (!out) {
  console.error("usage: reference-sheet.mjs <out-dir> [scene ...]");
  process.exit(1);
}
const here = fileURLToPath(new URL(".", import.meta.url));
const scenes = JSON.parse(readFileSync(join(here, "reference-scenes.json"), "utf8"));
const frames = join(here, "../../docs/reference/frames");
mkdirSync(out, { recursive: true });
const H = 480;
for (const [name, s] of Object.entries(scenes)) {
  if (name.startsWith("_") || (only.length > 0 && !only.includes(name))) continue;
  const dir = join(out, `shot-${name}`);
  const env = { ...process.env, SHOT_WAIT: "24000", ...(s.inspect ? { SHOT_INSPECT: s.inspect } : {}), ...(s.script ? { SHOT_SCRIPT: s.script } : {}), ...(s.before ? { SHOT_BEFORE: s.before, SHOT_BEFORE_WAIT: "15000" } : {}) };
  const query = `${s.query}&hours=${s.hours}&clock=stop&color=sepia`;
  const r = spawnSync(process.execPath, [join(here, "shot.mjs"), dir, query, String(s.seconds), "512", "412", ""], { stdio: "ignore", env, timeout: 560000 });
  if (r.status !== 0) {
    console.log(`${name}: shot failed`);
    continue;
  }
  const game = await sharp(join(dir, "scene.png")).resize({ height: H }).toBuffer({ resolveWithObject: true });
  const ref = await sharp(join(frames, `${s.frame}.jpg`)).resize({ height: H }).toBuffer({ resolveWithObject: true });
  await sharp({ create: { width: game.info.width + ref.info.width + 8, height: H, channels: 3, background: "#000" } })
    .composite([{ input: game.data, left: 0, top: 0 }, { input: ref.data, left: game.info.width + 8, top: 0 }])
    .jpeg({ quality: 88 })
    .toFile(join(out, `${name}.jpg`));
  console.log(`${name}: ${join(out, `${name}.jpg`)}`);
}
