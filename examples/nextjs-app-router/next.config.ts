import type { NextConfig } from "next";

// Same-origin ingestion proxy (spec §8.4): /a/e/* → collector. Next adds the visitor's IP to
// X-Forwarded-For; set the collector's TRUST_PROXY to the hops in front of it (docs/integration.md).
const collector = process.env.COLLECTOR_URL ?? "http://localhost:5100";

const config: NextConfig = {
  async rewrites() {
    return [{ source: "/a/e/:path*", destination: `${collector}/:path*` }];
  },
};

export default config;
