// Test-only write keys for the e2e projects (seed-e2e.mjs stores their SHA-256 in the test DB).
// Real token shape (`<tag>_<12 hex>_<43 base64url>`), so the API's shape check passes.
const token = (tag: "dpk" | "dsk", n: number, fill: string) =>
  `${tag}_e2e00000000${n}_${fill.repeat(43)}`;

export const PROJECTS = {
  vite: { slug: "e2e-vite", origin: "http://localhost:5302", key: token("dpk", 1, "v") },
  next: { slug: "e2e-next", origin: "http://localhost:5303", key: token("dpk", 2, "n") },
  script: { slug: "e2e-script", origin: "http://localhost:5304", key: token("dpk", 3, "s") },
} as const;

/** A `write_server` key of the Next.js project (server events with revenue). */
export const SERVER_KEY = token("dsk", 4, "k");

/** The real API under test (playwright.config.ts starts it on the test DB). */
export const API_URL = "http://localhost:5306";

/** The dashboard's production build (`vite preview`), same-origin with the API through `/api`. */
export const DASHBOARD_URL = "http://127.0.0.1:5173";

/** Dashboard accounts (seed-e2e.mjs stores Argon2id hashes). Test-only passwords. */
export const USERS = {
  owner: { email: "e2e-owner@example.com", password: "e2e owner passphrase 1" },
  /** Created with a temporary password: must choose a new one at first login (ADR 0024). */
  fresh: { email: "e2e-fresh@example.com", password: "TEMP-e2e-passphrase-2" },
} as const;
