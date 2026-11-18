/* global navigator, fetch, caches, document, URL */
/**
 * PWA check: serves the built game (packages/app/dist) on localhost, opens it in headless Chromium,
 * waits for the service worker to take over and cache what the first visit loaded, then cuts the
 * network and reloads: the game must start offline. Also reads the manifest and its icons.
 *
 * Usage: pnpm build && node tools/pwa/pwa-check.mjs
 */
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { extname, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright");
const dist = join(dirname(fileURLToPath(import.meta.url)), "../../packages/app/dist");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".glb": "model/gltf-binary", ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".mp3": "audio/mpeg", ".bin": "application/octet-stream", ".woff2": "font/woff2", ".woff": "font/woff" };
const server = createServer((req, res) => {
  let path = join(dist, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (path.endsWith("/")) path = join(path, "index.html");
  if (!existsSync(path) || !extname(path)) return res.writeHead(404).end();
  res.writeHead(200, { "content-type": types[extname(path)] ?? "application/octet-stream" }).end(readFileSync(path));
});
await new Promise((r) => server.listen(0, r));
const url = `http://localhost:${server.address().port}/index.html?seed=7&hud=0`;
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const context = await browser.newContext({ viewport: { width: 640, height: 360 } });
const page = await context.newPage();
await page.addInitScript('localStorage.setItem("broadside.help", "1")');
await page.goto(url);
await page.waitForFunction(() => globalThis.__broadside !== undefined, null, { timeout: 90000 });
const manifest = await page.evaluate(async () => {
  const href = document.querySelector('link[rel="manifest"]')?.getAttribute("href");
  const m = href ? await (await fetch(href)).json() : null;
  const icons = m ? await Promise.all(m.icons.map(async (i) => (await fetch(i.src)).ok)) : [];
  return { name: m?.name, display: m?.display, icons: icons.length, iconsOk: icons.every(Boolean) };
});
const registered = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.ready;
  return Boolean(reg.active);
});
// Let the worker store what the first visit loaded.
await page.waitForTimeout(15000);
const cached = await page.evaluate(async () => (await (await caches.open("broadside-v1")).keys()).length);
await context.setOffline(true);
await page.reload();
const offline = await page
  .waitForFunction(() => globalThis.__broadside !== undefined, null, { timeout: 90000 })
  .then(() => true)
  .catch(() => false);
await browser.close();
server.close();
const result = { manifest, registered, cached, offline };
console.log(JSON.stringify(result));
if (!manifest.iconsOk || !registered || !offline) process.exitCode = 1;
