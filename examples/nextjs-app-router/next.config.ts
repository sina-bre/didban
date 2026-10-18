import type { NextConfig } from "next";

// Same-origin ingestion proxy (spec §8.4): /a/e/* → collector. Next passes X-Forwarded-For on but
// never adds the visitor's IP, so put Caddy/Nginx in front and count both hops in the collector's
// TRUST_PROXY (docs/sdk.md; pinned by e2e/tests/nextjs.spec.ts).
const collector = process.env.COLLECTOR_URL ?? "http://localhost:5100";

const config: NextConfig = {
  async rewrites() {
    return [{ source: "/a/e/:path*", destination: `${collector}/:path*` }];
  },
};

export default config;
