import optimizeLocales from "@react-aria/optimize-locales-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// ADR 0021: Vite on 5173 (strict), `/api` proxied to the API so the browser stays same-origin
// (spec §11 CSRF rule). `preview` serves the production build the same way (E2E uses it).
const proxy = { "/api": { target: process.env.API_URL ?? "http://127.0.0.1:5100" } };
const server = { host: "127.0.0.1", port: 5173, strictPort: true, proxy };

export default defineConfig({
  // React Aria ships strings for ~34 locales; it has none for `fa`, so only en-US is kept
  // (fa falls back to it). ADR 0040.
  plugins: [react(), tailwindcss(), optimizeLocales.vite({ locales: ["en-US"] })],
  server,
  preview: server,
  build: { target: "es2023", assetsInlineLimit: 0 },
});
