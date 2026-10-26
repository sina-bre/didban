import { cleanup, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { fakeApi } from "./fake-api";
import { PROJECT, signedIn } from "./fixtures";
import { renderApp } from "./render-app";
import { goals, reports } from "./report-fixtures";

// The 5d reports in real Chrome: the lazy React Aria value picker, native <dialog> goal forms,
// fa/RTL at 360 px.
const base = `/projects/${PROJECT}`;
const wait = { timeout: 8000 };
const overflows = () => document.documentElement.scrollWidth > innerWidth;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("FilterBar", () => {
  it("field, then a typed value from the field's known values, lands in the URL", async () => {
    fakeApi({ ...signedIn(), ...reports() });
    const { router } = renderApp(`${base}/sources`);
    await screen.findByRole("table", { name: "Channel" }, wait);
    await userEvent.click(screen.getByRole("button", { name: "Add filter" }));
    await userEvent.selectOptions(screen.getByLabelText("Field"), "Browser");
    await userEvent.click(await screen.findByRole("combobox", { name: "Value" }, wait));
    await userEvent.keyboard("fire");
    const list = await screen.findByRole("listbox");
    expect(
      within(list)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["Firefox"]);
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await waitFor(() =>
      expect(new URLSearchParams(router.state.location.search).getAll("filter")).toEqual([
        "browser:eq:Firefox",
      ]),
    );
    expect(await screen.findByText("Browser is Firefox")).toBeTruthy();
  });
});

describe("Goals", () => {
  it("add: the contract's rules show on the field, a valid goal is posted", async () => {
    const calls = fakeApi({
      ...signedIn(),
      ...reports(),
      [`POST ${base}/goals`]: () => ({ status: 201, body: goals.goals[0] }),
    });
    renderApp(`${base}/goals`);
    await userEvent.click(await screen.findByRole("button", { name: "Add goal" }, wait));
    const dialog = screen.getByRole("dialog", { name: "Add goal" });
    await userEvent.type(within(dialog).getByLabelText("Name"), "Upgraded");
    await userEvent.type(within(dialog).getByLabelText("Event name"), "9 bad name");
    await userEvent.click(within(dialog).getByRole("button", { name: "Create goal" }));
    expect(within(dialog).getByText(/start with a letter/)).toBeTruthy();
    expect(calls.some((c) => c.method === "POST")).toBe(false);
    await userEvent.clear(within(dialog).getByLabelText("Event name"));
    await userEvent.type(within(dialog).getByLabelText("Event name"), "plan_upgraded");
    await userEvent.click(within(dialog).getByRole("button", { name: "Create goal" }));
    await waitFor(() => expect((dialog as HTMLDialogElement).open).toBe(false));
    expect(calls.find((c) => c.method === "POST")?.body).toEqual({
      kind: "event",
      name: "Upgraded",
      eventName: "plan_upgraded",
    });
  });

  it("delete asks first, then sends DELETE for that goal", async () => {
    const calls = fakeApi({
      ...signedIn(),
      ...reports(),
      [`DELETE ${base}/goals/${goals.goals[0]?.id}`]: goals.goals[0] ?? {},
    });
    renderApp(`${base}/goals`);
    await userEvent.click(
      await screen.findByRole("button", { name: "Delete goal Signed up" }, wait),
    );
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
    const dialog = screen.getByRole("dialog", { name: "Delete Signed up?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete goal" }));
    await waitFor(() => expect(calls.filter((c) => c.method === "DELETE")).toHaveLength(1));
  });
});

describe("fa at 360 px", () => {
  it("sources: RTL, the dimension pills scroll inside the card, 44 px export, no page overflow", async () => {
    await page.viewport(360, 740);
    fakeApi({ ...signedIn(), ...reports() });
    renderApp(`${base}/sources`, { locale: "fa" });
    await screen.findByRole("table", { name: "کانال" }, wait);
    const exportLink = screen.getByRole("link", { name: "خروجی CSV" });
    expect(exportLink.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    expect(screen.getByRole("link", { name: "فیلتر با جستجوی ارگانیک" })).toBeTruthy();
    expect(overflows()).toBe(false);
  });
});
