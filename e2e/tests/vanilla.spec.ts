import { expect, test } from "@playwright/test";
import { clearRecords, events, eventually, LOOPBACK, pagePaths, records } from "./collector.js";

const SITE = "http://localhost:5302";
const KEY = "wk_e2e_vite";

test.beforeEach(clearRecords);

test("pushState views, modules and the Vite proxy (production build)", async ({ page }) => {
  await page.goto(`${SITE}/`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("link", { name: "Pricing" }).click();
  await page.getByRole("link", { name: "Docs" }).click();
  await page.getByRole("button", { name: /Sign up/ }).click();
  await page.locator("#outbound").click();
  await page.locator("#download").click();
  await page.mouse.wheel(0, 100_000);
  await eventually(
    () => events(KEY),
    (list) => {
      expect(pagePaths(list)).toEqual(["/", "/pricing", "/docs?tab=api"]);
      const custom = list.filter((e) => e.type === "track");
      const props = (name: string) =>
        custom.filter((e) => e.name === name).map((e) => e.properties);
      expect(props("signup_clicked")).toEqual([{ plan: "free" }]);
      expect(props("outbound_click")).toEqual([{ url: "https://example.org/partner" }]);
      expect(props("file_download")).toEqual([{ url: `${SITE}/files/brochure.pdf` }]);
      expect(props("scroll_depth").map((p) => p.percent)).toContain(100);
    },
  );
  for (const r of await records(KEY)) expect(r.forwardedFor ?? "").toMatch(LOOPBACK);
});
