import { defineConfig } from "tsdown";

// ESM + types + source maps for npm, plus the minified script-tag IIFE `dist/didban.js` (spec §8.5).
// Published files import no private workspace package (ADR 0010, 0029).
export default defineConfig([
  {
    entry: {
      index: "src/index.ts",
      "outbound-links": "src/modules/outbound-links.ts",
      "file-downloads": "src/modules/file-downloads.ts",
      "scroll-depth": "src/modules/scroll-depth.ts",
      "engaged-time": "src/modules/engaged-time.ts",
    },
    format: ["esm"],
    platform: "browser",
    target: "es2020",
    dts: true,
    sourcemap: true,
    fixedExtension: false,
  },
  {
    entry: { didban: "src/script.ts" },
    format: ["iife"],
    platform: "browser",
    target: "es2020",
    minify: true,
    sourcemap: true,
    clean: false,
  },
]);
