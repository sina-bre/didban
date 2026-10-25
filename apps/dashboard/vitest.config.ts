import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

// Two projects: `unit` (jsdom, logic and markup) and `browser` (real Chrome with our CSS, for
// layout, keyboard and RTL checks of the shared/ui widgets). Chrome is the installed channel,
// the same one the E2E suite uses, so no browser download is needed.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    restoreMocks: true,
    projects: [
      {
        extends: true,
        test: { name: "unit", include: ["test/**/*.test.{ts,tsx}"], environment: "jsdom" },
      },
      {
        extends: true,
        test: {
          name: "browser",
          include: ["test/**/*.browser.tsx"],
          setupFiles: ["test/browser-setup.ts"],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({ launchOptions: { channel: "chrome" } }),
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
