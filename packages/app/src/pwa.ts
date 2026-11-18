/**
 * Installable web app (PWA): registers the service worker (public/sw.js) in a browser over HTTPS or
 * on localhost. Not in the Android app (Capacitor serves the files from the APK itself).
 */
export const registerServiceWorker = (): void => {
  const nav = globalThis.navigator as Navigator | undefined;
  if (!nav || !("serviceWorker" in nav)) return;
  const native = (globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.() ?? false;
  if (native) return;
  const secure = globalThis.location.protocol === "https:" || globalThis.location.hostname === "localhost";
  if (!secure) return;
  void nav.serviceWorker.register("./sw.js").catch(() => undefined);
  // The first visit loads the game before the worker runs: once it is ready, hand it the files
  // already loaded (Resource Timing), so the next start works offline too.
  void nav.serviceWorker.ready.then((reg) => {
    const own = performance
      .getEntriesByType("resource")
      .map((e) => e.name)
      .filter((u) => u.startsWith(globalThis.location.origin));
    reg.active?.postMessage({ type: "cache", urls: [...new Set(own)] });
  });
};
