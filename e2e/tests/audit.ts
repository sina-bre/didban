import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

// Checks every dashboard page gets in the a11y/RTL audit (Stage 5f): axe with the WCAG 2.2 AA
// rules, no sideways scrolling, and 44 px touch targets on phones (addendum A6).

/** axe violations as "rule: target" lines, so a failure names what to fix. */
export async function axeViolations(page: Page): Promise<string[]> {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  return result.violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(" ")}`));
}

export const overflows = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

/**
 * Visible controls smaller than 44 x 44 px. Links inside running text are exempt (WCAG 2.5.8
 * inline exception), and so are controls a 44 px label wraps (visually hidden radios, switches).
 */
export function smallTargets(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const selector = "button, a[href], input:not([type=hidden]), select, textarea, [role=tab]";
    const box = (el: Element) => (el.closest("label") ?? el).getBoundingClientRect();
    return [...document.querySelectorAll<HTMLElement>(selector)]
      .filter((el) => box(el).width > 1 && !el.closest("p, figcaption")) // hidden, sr-only, in text
      .filter((el) => box(el).width < 44 || box(el).height < 44)
      .map((el) => {
        const { width, height } = box(el);
        const name = el.getAttribute("aria-label") ?? el.textContent?.trim().slice(0, 30);
        return `${el.tagName.toLowerCase()} "${name}" ${Math.round(width)}x${Math.round(height)}`;
      });
  });
}

/** One page, one viewport: rtl, no overflow, no axe violations, big targets on phones. */
export async function auditPage(page: Page, url: string, width: number): Promise<void> {
  await page.setViewportSize({ width, height: width < 768 ? 740 : 800 });
  await page.goto(url);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await page.waitForLoadState("networkidle"); // data in; a chart below the fold stays a placeholder
  await expect(page.locator("[aria-busy=true]")).toHaveCount(0);
  const where = `${url} at ${width} px`;
  expect.soft(await overflows(page), `${where} scrolls sideways`).toBe(false);
  expect.soft(await axeViolations(page), where).toEqual([]);
  if (width < 768) expect.soft(await smallTargets(page), where).toEqual([]);
}
