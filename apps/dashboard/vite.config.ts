import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// ADR 0021: Vite on 5173 (strict), `/api` proxied to the API so the browser stays same-origin
// (spec §11 CSRF rule). `preview` serves the production build the same way (E2E uses it).
const proxy = { "/api": { target: process.env.API_URL ?? "http://127.0.0.1:5100" } };
const server = { host: "127.0.0.1", port: 5173, strictPort: true, proxy };

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server,
  preview: server,
  build: { target: "es2023", assetsInlineLimit: 0 },
});
