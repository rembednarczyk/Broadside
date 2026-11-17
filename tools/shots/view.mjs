#!/usr/bin/env node
/**
 * Shot of a named view (tools/shots/views.json) at any hour of the day, with the clock stopped so
 * the light does not move while the shot is taken (SekiSenshi's preview views, here for Broadside).
 *
 * Usage: node tools/shots/view.mjs <view> [HH:MM] [out-dir]
 *   e.g. node tools/shots/view.mjs reference 06:30 shots/dawn
 * Extra environment (SHOT_SCRIPT, SHOT_EVAL, ...) passes through to shot.mjs.
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import process from "node:process";
import { URL } from "node:url";

const [name, hours = "16:20", out = join("shots", name ?? "")] = process.argv.slice(2);
const views = JSON.parse(readFileSync(new URL("./views.json", import.meta.url), "utf8"));
const v = views[name];
if (!v || name.startsWith("_")) {
  console.error(`unknown view "${name}"; views: ${Object.keys(views).filter((k) => !k.startsWith("_")).join(", ")}`);
  process.exit(1);
}
const query = `${v.query}&hours=${hours}&clock=stop`;
const env = { ...process.env, ...(v.script && !process.env.SHOT_SCRIPT ? { SHOT_SCRIPT: v.script } : {}) };
const args = [new URL("./shot.mjs", import.meta.url).pathname, out, query, String(v.seconds), String(v.width ?? 960), String(v.height ?? 540), v.cam ?? ""];
const r = spawnSync(process.execPath, args, { stdio: "inherit", env });
process.exit(r.status ?? 1);
