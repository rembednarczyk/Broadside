import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/test/**/*.test.{ts,tsx}", "tools/*/test/**/*.test.ts"],
    environment: "node",
    testTimeout: 20_000,
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**/*.{ts,tsx}"],
      exclude: ["packages/engine/**", "packages/app/**", "**/index.ts", "**/*.generated.ts"],
      reporter: ["text-summary", "json-summary"],
      reportsDirectory: "reports/coverage",
      thresholds: {
        "packages/core/src/**": { statements: 90, branches: 80, functions: 90, lines: 90 },
        "packages/sim/src/**": { statements: 80, branches: 70, functions: 80, lines: 80 },
      },
    },
  },
});
