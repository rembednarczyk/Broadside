import { defineConfig } from "vitest/config";

/** Numeric audits with a report (podrcr's `vitest.audit.config.ts`): not part of `pnpm test`. */
export default defineConfig({
  test: { include: ["packages/*/test/**/*.audit.ts"], environment: "node", testTimeout: 600_000 },
});
