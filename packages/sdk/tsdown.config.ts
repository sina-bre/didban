import { defineConfig } from "tsdown";

// ESM + types + source maps for npm (spec §8.5). `@didban/contracts` is a devDependency, so its
// constants are inlined and the published files import no private workspace package (ADR 0010).
export default defineConfig({
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
});
