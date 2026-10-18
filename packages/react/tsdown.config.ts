import { defineConfig } from "tsdown";

// ESM + types + source maps. Rolldown keeps the entry's "use client" directive at the top of
// dist/index.js (addendum A2: RSC-safe adapter entry); scripts/check-directive.mjs checks it.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "browser",
  target: "es2020",
  dts: true,
  sourcemap: true,
  fixedExtension: false,
  // The warning says a directive *may* be dropped; with one entry it is kept (checked on build).
  checks: { moduleLevelDirective: false },
});
