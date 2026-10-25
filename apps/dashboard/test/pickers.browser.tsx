import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { DateRangePicker, OrgProjectSwitcher, TimeSeriesChart } from "../src/shared/components";
import ComboBox from "../src/shared/ui/combo-box";
import DateRangeField from "../src/shared/ui/date-range-field";
import { renderUi } from "./render";

// The React Aria widgets and the bigger wrappers, in real Chrome, RTL/fa and 360 px.
const overflows = () => document.documentElement.scrollWidth > innerWidth;

describe("DateRangeField (React Aria)", () => {
  it("fa: Persian calendar, RTL arrows, Gregorian ISO out", async () => {
    const onChange = vi.fn();
    const value = { start: "2026-10-01", end: "2026-10-10" };
    renderUi(
      <DateRangeField
        label="Dates"
        locale="fa-IR"
        value={value}
        max="2026-10-25"
        onChange={onChange}
      />,
      { locale: "fa" },
    );
    await userEvent.click(screen.getByRole("button", { name: /Calendar/ }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.querySelector("h2")?.textContent).toMatch(/۱۴۰۵ مهر|مهر ۱۴۰۵/); // 1 Oct 2026 = 9 Mehr 1405
    const focused = () => document.activeElement?.textContent;
    await userEvent.keyboard("{Enter}"); // start: 9 Mehr = 1 Oct
    const before = focused();
    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}"); // ArrowLeft is "next day" in RTL
    expect([before, focused()]).toEqual(["۱۰", "۱۲"]);
    await userEvent.keyboard("{Enter}"); // end: 12 Mehr = 4 Oct
    expect(onChange).toHaveBeenCalledWith({ start: "2026-10-01", end: "2026-10-04" });
  });
});

describe("ComboBox (React Aria)", () => {
  it("filters as you type and selects with the keyboard", async () => {
    const onSelect = vi.fn();
    const options = [
      { id: "IR", label: "Iran" },
      { id: "DE", label: "Germany" },
      { id: "FR", label: "France" },
    ];
    await page.viewport(360, 740); // full-width field: its list must not push the page sideways
    renderUi(
      <ComboBox label="Country" options={options} onSelect={onSelect} emptyLabel="No matches" />,
    );
    await userEvent.click(screen.getByRole("combobox", { name: "Country" }));
    await userEvent.keyboard("ger");
    const list = await screen.findByRole("listbox");
    expect([...list.querySelectorAll('[role="option"]')].map((o) => o.textContent)).toEqual([
      "Germany",
    ]);
    expect(overflows()).toBe(false);
    const input = screen.getByRole("combobox");
    await userEvent.keyboard("{ArrowDown}");
    expect(input.getAttribute("aria-activedescendant")).toBeTruthy();
    await userEvent.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith("DE");
  });
});

describe("TimeSeriesChart", () => {
  const points = [1, 2, 3, 4, 5].map((d) => ({
    date: new Date(2026, 9, d),
    value: d * 10,
    previous: d,
  }));

  it("fa: mirrored time axis, labeled axes, and the same data as a table", async () => {
    await page.viewport(360, 740);
    renderUi(<TimeSeriesChart title="Visitors over time" valueLabel="Visitors" points={points} />, {
      locale: "fa",
    });
    const tickTexts = () =>
      [...document.querySelectorAll(".recharts-cartesian-axis-tick-value")].filter((t) =>
        t.textContent?.includes("مهر"),
      );
    await waitFor(
      () => expect(tickTexts().filter((t) => t.textContent).length).toBeGreaterThan(1),
      {
        timeout: 5000, // Recharts is a lazy chunk; slower when the unit project runs alongside
      },
    );
    const ticks = tickTexts();
    const x = (el: Element | undefined) => el?.getBoundingClientRect().x ?? 0;
    expect(x(ticks[0])).toBeGreaterThan(x(ticks.at(-1))); // first day on the right
    expect(document.querySelector(".recharts-label")?.textContent).toBeTruthy();
    expect(overflows()).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: "نمایش جدول" }));
    const table = screen.getByRole("table", { name: "Visitors over time" });
    expect(table.querySelectorAll("tbody tr")).toHaveLength(5);
    expect(table.textContent).toContain("۵۰");
  });
});

describe("OrgProjectSwitcher", () => {
  it("360 px RTL: grouped project links on screen, current marked, Escape closes", async () => {
    await page.viewport(360, 740);
    const orgs = [
      {
        id: "o1",
        name: "Acme",
        projects: [
          { id: "p1", name: "Shop" },
          { id: "p2", name: "Blog" },
        ],
      },
      { id: "o2", name: "Beta", projects: [{ id: "p3", name: "Docs" }] },
    ];
    renderUi(<OrgProjectSwitcher orgs={orgs} currentProjectId="p2" />, { locale: "fa" });
    await userEvent.click(screen.getByRole("button", { name: /Acme \/ Blog/ }));
    const nav = screen.getByRole("navigation");
    const box = nav.getBoundingClientRect();
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(innerWidth);
    expect(screen.getByRole("link", { name: "Blog" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("region", { name: "Beta" }).textContent).toContain("Docs");
    await userEvent.keyboard("{Escape}");
    expect(nav.matches(":popover-open")).toBe(false);
  });
});

describe("DateRangePicker", () => {
  it("360 px fa: presets fit, Custom reveals the lazy date field", async () => {
    await page.viewport(360, 740);
    renderUi(<DateRangePicker />, { locale: "fa", path: "/?range=7d" });
    expect((screen.getByRole("radio", { name: "۷ روز" }) as HTMLInputElement).checked).toBe(true);
    expect(overflows()).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: "دلخواه" }));
    expect(await screen.findByText("تاریخ شروع و پایان")).toBeTruthy();
    expect(overflows()).toBe(false);
  });
});
