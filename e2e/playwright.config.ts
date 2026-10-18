import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { defineConfig } from "@playwright/test";
import { API_URL, PROJECTS, SERVER_KEY } from "./tests/keys.js";

// Stage 3 host-site checks, end to end. Every example proxies /a/e to the recording hop
// (collector.mjs, 5301), which forwards to the real API (5306) on the local test DB, seeded by
// seed-e2e.mjs. One worker: tests share the recorder and the database. Needs `pnpm build` first.
// Only the two test-DB URLs come from ../.env (written by `pnpm db:setup`); the rest of it (PORT, the
// dev DATABASE_URL) must not leak into the web servers.
const dotenv = existsSync("../.env") ? parseEnv(readFileSync("../.env", "utf8")) : {};
const fromEnv = (name: string) => process.env[name] ?? dotenv[name] ?? "";
process.env.TEST_DATABASE_URL = fromEnv("TEST_DATABASE_URL"); // tests/db.ts, in the workers
const COLLECTOR_URL = "http://localhost:5301";
const DESKTOP_CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

const api = {
  NODE_ENV: "development",
  PORT: "5306",
  PUBLIC_ORIGIN: API_URL,
  SESSION_COOKIE: "insecure-dev",
  DATABASE_URL: fromEnv("TEST_DATABASE_URL"),
  TEST_MIGRATION_DATABASE_URL: fromEnv("TEST_MIGRATION_DATABASE_URL"), // seed-e2e.mjs
  TRUST_PROXY: "1", // the example's proxy sets X-Forwarded-For; the recorder passes it on
  LOG_LEVEL: "warn",
  E2E_SEED: JSON.stringify({ projects: PROJECTS, serverKey: SERVER_KEY }),
};

export default defineConfig({
  testDir: "tests",
  timeout: 60_000,
  workers: 1,
  reporter: "list",
  // Headless Chrome says "HeadlessChrome" in its user agent, which the API rightly drops as a bot.
  use: { channel: "chrome", headless: true, userAgent: DESKTOP_CHROME },
  webServer: [
    {
      command: "node seed-e2e.mjs && node ../apps/api/dist/main.js",
      url: `${API_URL}/api/v1/health/ready`,
      env: api,
    },
    { command: "node collector.mjs", port: 5301, env: { UPSTREAM: API_URL } },
    {
      command: "pnpm -C ../examples/vanilla-vite build && pnpm -C ../examples/vanilla-vite preview",
      port: 5302,
      env: { COLLECTOR_URL, VITE_DIDBAN_WRITE_KEY: PROJECTS.vite.key },
      timeout: 120_000,
    },
    {
      command: "pnpm -C ../examples/nextjs-app-router dev",
      port: 5303,
      env: { COLLECTOR_URL, NEXT_PUBLIC_DIDBAN_WRITE_KEY: PROJECTS.next.key },
      timeout: 180_000,
    },
    { command: "node front-proxy.mjs", port: 5305, env: { TARGET: "http://localhost:5303" } },
    {
      command: "pnpm -C ../examples/script-tag start",
      port: 5304,
      env: { COLLECTOR_URL, DIDBAN_WRITE_KEY: PROJECTS.script.key },
    },
  ],
});
