import optimizeLocales from "@react-aria/optimize-locales-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// ADR 0021: Vite on 5173 (strict), `/api` proxied to the API so the browser stays same-origin
// (spec §11 CSRF rule). `preview` serves the production build the same way (E2E uses it).
const proxy = { "/api": { target: process.env.API_URL ?? "http://127.0.0.1:5100" } };
const server = { host: "127.0.0.1", port: 5173, strictPort: true, proxy };
// TanStack Query and the modules the entry's prefetch and every report load first.
const FIRST_SCREEN =
  /[\\/]features[\\/](auth[\\/]use-me|projects[\\/]use-projects?|overview[\\/]use-overview)\./;
const REPORT_PARTS = /[\\/]features[\\/]report[\\/](use-stats|query-|report-header|channel-label)/;
const CORE = {
  name: "core",
  test: (id: string) =>
    /[\\/]@tanstack[\\/]/.test(id) || FIRST_SCREEN.test(id) || REPORT_PARTS.test(id),
  includeDependenciesRecursively: false,
};

export default defineConfig({
  // React Aria ships strings for ~34 locales; it has none for `fa`, so only en-US is kept
  // (fa falls back to it). ADR 0040.
  plugins: [react(), tailwindcss(), optimizeLocales.vite({ locales: ["en-US"] })],
  server,
  preview: server,
  build: {
    target: "es2023",
    assetsInlineLimit: 0,
    // Shared code became many ~0.5 KB chunks (each icon, each query hook); on a phone every extra
    // request costs a round trip. One icon chunk, and one core chunk for what the first screen
    // and every report share (Lighthouse mobile, Stage 5f).
    rolldownOptions: {
      output: { codeSplitting: { groups: [{ name: "icons", test: /lucide-react/ }, CORE] } },
    },
  },
});
