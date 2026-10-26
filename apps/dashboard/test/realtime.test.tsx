import { QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createQueryClient } from "../src/app/query-client";
import { REALTIME_POLL_MS, useRealtime } from "../src/features/realtime/use-realtime";
import { fakeApi } from "./fake-api";
import { PROJECT, signedIn } from "./fixtures";
import { renderApp } from "./render-app";

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
  document.dispatchEvent(new Event("visibilitychange", { bubbles: true })); // as browsers fire it
}

const realtimeCalls = (calls: ReturnType<typeof fakeApi>) =>
  calls.filter((c) => c.url.pathname.endsWith("/stats/realtime")).length;

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  setVisibility("visible");
});

describe("Realtime polling", () => {
  it("polls every 10 s, stops while the tab is hidden, refetches when it is back", async () => {
    vi.useFakeTimers();
    const calls = fakeApi(signedIn());
    const client = createQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    renderHook(() => useRealtime(PROJECT), { wrapper });
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(realtimeCalls(calls)).toBe(1);
    await act(() => vi.advanceTimersByTimeAsync(REALTIME_POLL_MS * 2));
    expect(realtimeCalls(calls)).toBe(3);

    setVisibility("hidden");
    await act(() => vi.advanceTimersByTimeAsync(REALTIME_POLL_MS * 6));
    expect(realtimeCalls(calls)).toBe(3);

    setVisibility("visible");
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(realtimeCalls(calls)).toBe(4);
    await act(() => vi.advanceTimersByTimeAsync(REALTIME_POLL_MS));
    expect(realtimeCalls(calls)).toBe(5);
    client.clear();
  });
});

describe("Realtime page", () => {
  it("shows active visitors, active pages, sources and recent events", async () => {
    fakeApi(signedIn());
    renderApp(`/projects/${PROJECT}/realtime`);
    const active = await screen.findByRole(
      "region",
      { name: "Active visitors" },
      { timeout: 5000 },
    );
    expect(within(active).getAllByText("7").length).toBeGreaterThan(0);
    const [pages] = screen.getAllByRole("region", { name: "Active pages" }); // card + its table
    expect(within(pages as HTMLElement).getByText("/products/:id")).toBeTruthy();
    expect(
      within(screen.getByRole("region", { name: "Top sources" })).getByText("Social"),
    ).toBeTruthy();
    const [recent] = screen.getAllByRole("region", { name: "Recent events" });
    expect(within(recent as HTMLElement).getByText("Page view")).toBeTruthy();
    expect(within(recent as HTMLElement).getByText("signup")).toBeTruthy();
  });
});
