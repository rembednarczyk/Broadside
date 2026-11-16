import js from "@eslint/js";
import tseslint from "typescript-eslint";

/** Determinism (ADR-0003): randomness through RandomPort, time through the fixed step. */
const nondeterminism = [
  { object: "Math", property: "random", message: "Use the seeded Rng (core/math/rng) in core/sim." },
  { object: "Date", property: "now", message: "Simulation time comes from the fixed step in core/sim." },
  { object: "performance", property: "now", message: "Simulation time comes from the fixed step in core/sim." },
];

export default tseslint.config(
  { ignores: ["**/dist/**", "packages/app/android/**", "**/coverage/**", "reports/**", "playwright-report/**", "test-results/**", "node_modules/**", ".claude/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
    },
  },
  {
    files: ["packages/core/src/**/*.ts", "packages/sim/src/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "no-restricted-properties": ["error", ...nondeterminism],
      "no-restricted-syntax": ["error", { selector: "NewExpression[callee.name='Date']", message: "No wall clock in core/sim." }],
    },
  },
  {
    // No god objects or god functions (ADR-0002). Blank lines and comments do not count.
    files: ["packages/*/src/**/*.ts", "packages/*/src/**/*.tsx", "tools/*/src/**/*.ts"],
    rules: {
      "max-lines": ["error", { max: 500, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": ["error", { max: 120, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    // Data tables, not logic.
    files: ["packages/core/src/data/**/*.ts", "packages/**/src/**/*.generated.ts"],
    rules: { "max-lines": "off" },
  },
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "**/test/**"],
    rules: { "@typescript-eslint/no-non-null-assertion": "off", "max-lines-per-function": "off" },
  },
  {
    files: ["**/*.cjs", "tools/**/*.mjs", "e2e/**/*.ts", "playwright.config.ts"],
    languageOptions: { globals: { process: "readonly", console: "readonly", require: "readonly", module: "writable", __dirname: "readonly" } },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
);
