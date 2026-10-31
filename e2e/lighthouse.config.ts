import { defineConfig } from "@playwright/test";
import base from "./playwright.config.js";

// Lighthouse on the production dashboard (`pnpm lighthouse`, after `pnpm build`): the e2e API on
// the seeded test DB and `vite preview`, nothing else (Lighthouse scales the CPU time it sees, so
// idle example servers must not compete). Not part of `pnpm test:e2e`: a measurement, recorded in
// docs/dashboard-performance.md.
const servers = [base.webServer ?? []].flat();
const webServer = servers.filter((s) => /api[\\/]dist[\\/]main|dashboard preview/.test(s.command));

export default defineConfig({ ...base, webServer, testDir: "lighthouse", timeout: 600_000 });
