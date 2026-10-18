import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Test against the SDK source so `pnpm test` works before `pnpm build`.
  resolve: {
    alias: { "@didban/analytics": fileURLToPath(new URL("../sdk/src/index.ts", import.meta.url)) },
  },
  test: {
    include: ["test/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    // A tracked (non-localhost) page, like the core SDK tests.
    environmentOptions: { jsdom: { url: "https://shop.example/start" } },
    restoreMocks: true,
  },
});
