import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
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
