import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeApi } from "./fake-api";
import { PROJECT, signedIn } from "./fixtures";
import { renderApp } from "./render-app";

const base = `/projects/${PROJECT}`;
// Report pages are lazy chunks: the first import is slow in jsdom.
const title = () => screen.findByRole("heading", { level: 1 }, { timeout: 5000 });

beforeEach(() => fakeApi(signedIn()));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.documentElement.lang = "en";
  document.documentElement.dir = "ltr";
});

describe("app shell", () => {
  it("shows the report title and the default 30-day range", async () => {
    renderApp(`${base}/overview`);
    expect((await title()).textContent).toBe("Overview");
    expect(screen.getByTestId("range").textContent).toContain("Last 30 days");
  });

  it("keeps the range in the URL when switching reports", async () => {
    renderApp(`${base}/pages?range=7d`);
    await title();
    const desktop = screen.getAllByRole("navigation", { name: "Reports" })[0];
    const link = desktop?.querySelector(`a[href^="${base}/sources"]`);
    expect(link?.getAttribute("href")).toBe(`${base}/sources?range=7d`);
    expect(screen.getByTestId("range").textContent).toContain("Last 7 days");
  });

  it("redirects / to the first project and a project root to its overview", async () => {
    const { router } = renderApp("/");
    await waitFor(() => expect(router.state.location.pathname).toBe(`${base}/overview`));
  });

  it("renders not found for an unknown report", async () => {
    renderApp(`${base}/cohorts`);
    expect((await title()).textContent).toBe("Page not found");
  });

  it("switches to Persian: rtl document, translated navigation", async () => {
    renderApp(`${base}/overview`);
    await title();
    fireEvent.click(screen.getByRole("button", { name: /^Switch language: فارسی$/ }));
    await screen.findByRole("heading", { level: 1, name: "نمای کلی" });
    expect(document.documentElement.dir).toBe("rtl");
    expect(document.documentElement.lang).toBe("fa");
    expect(localStorage.getItem("didban.locale")).toBe("fa");
  });

  it("range pills write ?range= and drop a custom range", async () => {
    const { router } = renderApp(`${base}/overview?from=2026-01-01&to=2026-01-05`);
    await title();
    expect(screen.getByTestId("range").textContent).toContain("Custom");
    fireEvent.click(screen.getByRole("radio", { name: /^7 days$/ }));
    expect(router.state.location.search).toBe("?range=7d");
    expect(screen.getByTestId("range").textContent).toContain("Last 7 days");
  });
});
