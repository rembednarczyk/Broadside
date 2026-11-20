/* global self, caches, fetch, URL, Response */
/**
 * Broadside's service worker: the game plays offline once it has been opened (strategies from Jake
 * Archibald's "The Offline Cookbook"):
 * - the page itself: network first, the cached copy when offline (a new build arrives at once);
 * - Vite's hashed bundles (name-HASH.js/.css): cache first (a new build has new names);
 * - everything else of the game's own (models, textures, sounds): stale-while-revalidate, served
 *   from the cache and refreshed behind it.
 * Bump CACHE to drop every cached file at the next start.
 */
const CACHE = "broadside-v1";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png"];
const HASHED = /-[A-Za-z0-9_-]{8,}\.(js|css)$/;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// The page hands over what it loaded before the worker ran (pwa.ts): keep it for offline starts.
self.addEventListener("message", (event) => {
  if (event.data?.type !== "cache" || !Array.isArray(event.data.urls)) return;
  const urls = event.data.urls.filter((u) => typeof u === "string" && new URL(u).origin === self.location.origin);
  event.waitUntil(caches.open(CACHE).then((c) => Promise.all(urls.map((u) => c.match(u).then((hit) => hit ?? c.add(u).catch(() => undefined))))));
});

const put = (request, response) => {
  if (response.ok && response.type === "basic") {
    const copy = response.clone();
    caches.open(CACHE).then((c) => c.put(request, copy));
  }
  return response;
};

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((r) => put(request, r))
        .catch(() => caches.match(request).then((r) => r ?? caches.match("./index.html")).then((r) => r ?? Response.error())),
    );
    return;
  }
  if (HASHED.test(new URL(request.url).pathname)) {
    event.respondWith(caches.match(request).then((hit) => hit ?? fetch(request).then((r) => put(request, r))));
    return;
  }
  event.respondWith(
    caches.match(request).then((hit) => {
      const fresh = fetch(request)
        .then((r) => put(request, r))
        .catch(() => hit ?? Response.error());
      return hit ?? fresh;
    }),
  );
});
