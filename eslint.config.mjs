import { defineConfig, globalIgnores } from "eslint/config";
import { fixupConfigRules } from "@eslint/compat";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export const baseConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "coverage/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

// Approved temporary ESLint 10 bridge for the legacy plugins pulled in by Next.
// Keep every rule; remove only after the documented plugin-support review.
// See docs/eslint-10-adoption-2026-09-08.md and the exact peer overrides.
export default fixupConfigRules(baseConfig);
