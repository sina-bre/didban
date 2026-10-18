import { defineConfig } from "@playwright/test";

// Stage 3e host-site checks. Every example proxies /a/e to the recording collector (collector.mjs)
// on 5301. One worker: the tests share that collector and read back what it recorded.
const COLLECTOR_URL = "http://localhost:5301";

export default defineConfig({
  testDir: "tests",
  timeout: 60_000,
  workers: 1,
  reporter: "list",
  use: { channel: "chrome", headless: true },
  webServer: [
    { command: "node collector.mjs", port: 5301 },
    {
      command: "pnpm -C ../examples/vanilla-vite build && pnpm -C ../examples/vanilla-vite preview",
      port: 5302,
      env: { COLLECTOR_URL, VITE_DIDBAN_WRITE_KEY: "wk_e2e_vite" },
      timeout: 120_000,
    },
    {
      command: "pnpm -C ../examples/nextjs-app-router dev",
      port: 5303,
      env: { COLLECTOR_URL, NEXT_PUBLIC_DIDBAN_WRITE_KEY: "wk_e2e_next" },
      timeout: 180_000,
    },
    { command: "node front-proxy.mjs", port: 5305, env: { TARGET: "http://localhost:5303" } },
    {
      command: "pnpm -C ../examples/script-tag start",
      port: 5304,
      env: { COLLECTOR_URL, DIDBAN_WRITE_KEY: "wk_e2e_script" },
    },
  ],
});
