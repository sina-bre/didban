import { defineConfig } from "vite";

// Same-origin ingestion proxy (spec §8.4): the browser posts to /a/e/api/v1/ingest/batch and the
// dev/preview server forwards it to the collector, adding X-Forwarded-For (`xfwd`) so the
// collector sees the visitor's IP. Production uses Caddy or Nginx instead (docs/sdk.md).
const collector = process.env.COLLECTOR_URL ?? "http://localhost:5100";
const proxy = {
  "/a/e": {
    target: collector,
    changeOrigin: true,
    xfwd: true,
    rewrite: (path: string) => path.replace(/^\/a\/e/, ""),
  },
};

export default defineConfig({
  server: { port: 5302, strictPort: true, proxy },
  preview: { port: 5302, strictPort: true, proxy },
});
