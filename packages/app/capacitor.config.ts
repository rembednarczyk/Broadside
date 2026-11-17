import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The Android app (ADR-0001, as SpinalTap ADR-0079): the Vite build inside a WebView, packed in
 * the APK. No server.url: the game is served from the files in the package.
 */
const config: CapacitorConfig = {
  appId: "pl.broadside.game",
  appName: "Broadside",
  webDir: "dist",
  backgroundColor: "#0b1218",
  android: { allowMixedContent: false },
  plugins: { SystemBars: { hidden: true } },
};

export default config;
