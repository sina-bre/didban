import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "jsdom",
    // A tracked (non-localhost) page; gate tests override the URL per file.
    environmentOptions: { jsdom: { url: "https://shop.example/start" } },
    restoreMocks: true,
  },
});
