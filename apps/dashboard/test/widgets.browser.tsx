import { screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { Menu, Segmented, Tabs, Tooltip } from "../src/shared/ui";
import { renderUi } from "./render";

// Real Chrome with our CSS: keyboard, top-layer popovers, anchor positioning, RTL, 360 px.
const inViewport = (el: Element) => {
  const box = el.getBoundingClientRect();
  return box.left >= 0 && box.right <= innerWidth && box.width > 0;
};

function TabsDemo() {
  const [tab, setTab] = useState<"a" | "b" | "c">("a");
  const tabs = [
    { id: "a", label: "One" },
    { id: "b", label: "Two" },
    { id: "c", label: "Three" },
  ] as const;
  return <Tabs label="Views" tabs={tabs} selected={tab} onSelect={setTab}>{`panel ${tab}`}</Tabs>;
}

describe("Menu", () => {
  it("opens with the first item focused, arrows move, Escape closes and returns focus", async () => {
    await page.viewport(360, 740);
    const onSelect = vi.fn();
    const items = [
      { id: "csv", label: "Export CSV" },
      { id: "env", label: "Production" },
    ];
    renderUi(<Menu label="Get report" items={items} onSelect={onSelect} />, { locale: "fa" });
    const trigger = screen.getByRole("button", { name: /^Get report$/ });
    await userEvent.click(trigger);
    const menu = screen.getByRole("menu");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement?.textContent).toBe("Export CSV");
    expect(inViewport(menu)).toBe(true); // anchored and kept on screen in RTL at 360 px
    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement?.textContent).toBe("Production");
    await userEvent.keyboard("{Escape}");
    expect(menu.matches(":popover-open")).toBe(false);
    expect(document.activeElement).toBe(trigger);
    await userEvent.click(trigger);
    await userEvent.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith("csv");
  });
});

describe("Tabs", () => {
  it("ArrowLeft selects the next tab in RTL, with one tab stop", async () => {
    renderUi(<TabsDemo />, { locale: "fa" });
    await userEvent.click(screen.getByRole("tab", { name: "One" }));
    await userEvent.keyboard("{ArrowLeft}");
    const two = screen.getByRole("tab", { name: "Two" });
    expect(two.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(two);
    expect(screen.getByRole("tabpanel").textContent).toBe("panel b");
    expect(screen.getAllByRole("tab").filter((t) => t.tabIndex === 0)).toEqual([two]);
  });
});

describe("Segmented", () => {
  it("is a radio group: arrows move the selection, the track scrolls inside 360 px", async () => {
    await page.viewport(360, 740);
    function Demo() {
      const [value, setValue] = useState("day");
      const options = ["hour", "day", "week", "month", "year"].map((v) => ({
        value: v,
        label: `By ${v}ly view`,
      }));
      return <Segmented label="Interval" value={value} options={options} onChange={setValue} />;
    }
    renderUi(<Demo />);
    await userEvent.click(screen.getByText("By dayly view")); // the input itself is visually hidden
    await userEvent.keyboard("{ArrowRight}");
    expect((screen.getByRole("radio", { name: /week/ }) as HTMLInputElement).checked).toBe(true);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(innerWidth);
    const label = screen.getByRole("radio", { name: /week/ }).closest("label") as HTMLElement;
    expect(label.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    // navy active pill, after the 120 ms color transition
    await expect.poll(() => getComputedStyle(label).backgroundColor).toBe("rgb(20, 33, 61)");
  });
});

describe("Tooltip", () => {
  it("shows on keyboard focus, hides on Escape", async () => {
    renderUi(<Tooltip label="No comparable previous value">—</Tooltip>);
    await userEvent.tab();
    const tip = screen.getByRole("tooltip", { hidden: true });
    expect(tip.matches(":popover-open")).toBe(true);
    expect(inViewport(tip)).toBe(true);
    await userEvent.keyboard("{Escape}");
    expect(tip.matches(":popover-open")).toBe(false);
  });
});
