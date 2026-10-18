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
