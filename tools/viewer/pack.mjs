#!/usr/bin/env node
/**
 * Packs the ship viewer for publishing as an artifact: builds the viewer entry as one script
 * (packages/app/vite.viewer.config.ts), writes the page (tools/viewer/page.html with the game's
 * stylesheet inlined) and copies what the player's ship needs. Models go as base64 inside JSON,
 * because the artifact host serves no .glb files; the page turns them back into object URLs.
 *
 * Usage: node tools/viewer/pack.mjs <out-dir>
 */
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const app = join(here, "../../packages/app");
const out = process.argv[2];
if (!out) {
  console.error("usage: pack.mjs <out-dir>");
  process.exit(1);
}
execFileSync("npx", ["vite", "build", "-c", "vite.viewer.config.ts"], { cwd: app, stdio: "inherit" });
rmSync(out, { recursive: true, force: true });
const pub = join(app, "public");
const MODELS = ["assets/hulls/galleon.glb", "assets/props/gun.glb", "assets/props/crew-anim.bin"];
const FILES = ["assets/hulls/galleon.json", "assets/hulls/galleon-planks.jpg", ...["dark_planks_diff", "dark_planks_nor_gl", "weathered_planks_diff", "weathered_planks_nor_gl"].map((t) => `assets/textures/${t}.jpg`), "assets/textures/rough_linen_detail.png"];
// The recorded sounds (ambience beds, ship sounds): without them the game falls back to a plain noise synth.
const AUDIO = readdirSync(join(pub, "assets/audio")).map((f) => `assets/audio/${f}`);
FILES.push(...AUDIO);
for (const f of [...MODELS, ...FILES]) mkdirSync(dirname(join(out, f)), { recursive: true });
for (const f of FILES) cpSync(join(pub, f), join(out, f));
for (const f of MODELS) writeFileSync(join(out, `${f}.json`), JSON.stringify({ base64: readFileSync(join(pub, f)).toString("base64") }));
cpSync(join(app, "dist-viewer/viewer.js"), join(out, "viewer.js"));
const css = readFileSync(join(app, "dist-viewer/viewer.css"), "utf8");
writeFileSync(join(out, "index.html"), readFileSync(join(here, "page.html"), "utf8").replace("/*VIEWER_CSS*/", () => css).replace("/*MODELS*/[]", () => JSON.stringify(MODELS)));
writeFileSync(join(out, "files.json"), JSON.stringify(["viewer.js", ...MODELS.map((f) => `${f}.json`), ...FILES]));
console.log(`packed ${out}: index.html, viewer.js, ${MODELS.length} models, ${FILES.length} files`);
