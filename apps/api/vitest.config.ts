import { existsSync } from "node:fs";
import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

// Test DB URLs come from the root .env written by `pnpm db:setup`. CI sets them as real env vars.
const envFile = new URL("../../.env", import.meta.url);
if (existsSync(envFile)) process.loadEnvFile(envFile);

// Nest needs decorator metadata, which esbuild does not emit; SWC does (spec §16).
export default defineConfig({
  plugins: [swc.vite({ swcrc: false, module: { type: "es6" } })],
  test: {
    include: ["src/**/*.test.ts"],
    setupFiles: ["reflect-metadata"],
    globalSetup: ["src/test-support/global-setup.ts"],
    fileParallelism: false, // one shared test database
  },
});
