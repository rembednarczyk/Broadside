import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * The ship viewer: the game opened on the player's ship with a free orbit, built as one script and
 * one stylesheet with fixed names so the page can be published as a few files (an artifact).
 * Build: pnpm --filter @broadside/app exec vite build -c vite.viewer.config.ts
 */
export default defineConfig({
  plugins: [react()],
  base: "./",
  publicDir: false,
  build: {
    target: "es2022",
    outDir: "dist-viewer",
    sourcemap: false,
    chunkSizeWarningLimit: 9000,
    rollupOptions: {
      input: "viewer.html",
      output: { inlineDynamicImports: true, entryFileNames: "viewer.js", assetFileNames: "viewer.[ext]" },
    },
  },
});
