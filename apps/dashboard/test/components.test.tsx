import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BreakdownTable,
  ChannelBadge,
  ErrorState,
  FilterBar,
  StatCard,
} from "../src/shared/components";
import { renderUi } from "./render";

afterEach(cleanup);

describe("StatCard", () => {
  it("shows a signed delta with an arrow, and no badge when comparison is off", () => {
    renderUi(<StatCard label="Visitors" value={12_400} delta={0.011} />);
    expect(screen.getByText("+1.1%")).toBeTruthy();
    expect(screen.getByText("12.4K")).toBeTruthy(); // compact below md
    expect(screen.getByText("12,400")).toBeTruthy(); // full from md
    cleanup();
    renderUi(<StatCard label="Visitors" value={5} />);
    expect(screen.queryByText(/%/)).toBeNull();
  });

  it("renders a null delta as — with the reason as its description", () => {
    renderUi(<StatCard label="Visitors" value={5} delta={null} />);
    const dash = screen.getByRole("button", { name: "—" });
    const tip = document.getElementById(dash.getAttribute("aria-describedby") ?? "");
    expect(tip?.textContent).toBe("No comparable previous value");
  });
});

describe("states and badges", () => {
  it("ErrorState is an alert with the request ID and a retry", () => {
    const retry = vi.fn();
    renderUi(<ErrorState requestId="req_123" onRetry={retry} />);
    expect(screen.getByRole("alert").textContent).toContain("Request ID: req_123");
    fireEvent.click(screen.getByRole("button", { name: /^Try again$/ }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it("ChannelBadge labels a channel code in the active locale", () => {
    renderUi(<ChannelBadge code={1} />, { locale: "fa" });
    expect(screen.getByText("جستجوی ارگانیک")).toBeTruthy();
  });
});

describe("BreakdownTable", () => {
  const rows = Array.from({ length: 12 }, (_, i) => ({
    key: `p${i}`,
    label: `/page-${i}`,
    sortText: `/page-${i}`,
    values: { visitors: i + 1 },
  }));
  const metrics = [{ key: "visitors", header: "Visitors" }];

  it("sorts by the first metric, toggles on click and pages by 10", () => {
    renderUi(<BreakdownTable caption="Top pages" dimension="Page" metrics={metrics} rows={rows} />);
    const table = screen.getByRole("table", { name: "Top pages" });
    const header = within(table).getByRole("columnheader", { name: /Visitors/ });
    expect(header.getAttribute("aria-sort")).toBe("descending");
    expect(within(table).getAllByRole("row")).toHaveLength(11);
    expect(within(table).getAllByRole("row")[1]?.textContent).toContain("/page-11");
    fireEvent.click(within(header).getByRole("button"));
    expect(header.getAttribute("aria-sort")).toBe("ascending");
    expect(screen.getByText("Page 1 of 2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Next page$/ }));
    expect(within(table).getAllByRole("row")).toHaveLength(3);
  });
});

describe("FilterBar", () => {
  it("describes each filter on its chip and removes it", () => {
    const onChange = vi.fn();
    const filters = [{ field: "country", op: "eq" as const, values: ["IR"] }];
    const fields = [{ id: "country", label: "Country" }];
    renderUi(
      <FilterBar
        filters={filters}
        fields={fields}
        field=""
        onFieldChange={() => {}}
        values={[]}
        valueLabel={(_, value) => (value === "IR" ? "Iran" : value)}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^Remove filter: Country is Iran$/ }));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});
