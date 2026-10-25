import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { routes } from "../src/app/routes";
import en from "../src/messages/en";
import { LocaleProvider } from "../src/shared/lib/locale-context";

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <LocaleProvider initial="en" messages={en}>
      <RouterProvider router={router} />
    </LocaleProvider>,
  );
  return router;
}

afterEach(() => {
  cleanup();
  document.documentElement.lang = "en";
  document.documentElement.dir = "ltr";
});

describe("app shell", () => {
  it("shows the report title and the default 30-day range", () => {
    renderAt("/projects/p1/overview");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Overview");
    expect(screen.getByTestId("range").textContent).toContain("Last 30 days");
  });

  it("keeps the range in the URL when switching reports", () => {
    renderAt("/projects/p1/pages?range=7d");
    const desktop = screen.getAllByRole("navigation", { name: "Reports" })[0];
    const link = desktop?.querySelector('a[href^="/projects/p1/sources"]');
    expect(link?.getAttribute("href")).toBe("/projects/p1/sources?range=7d");
    expect(screen.getByTestId("range").textContent).toContain("Last 7 days");
  });

  it("redirects a project root to its overview", () => {
    const router = renderAt("/projects/p1");
    expect(router.state.location.pathname).toBe("/projects/p1/overview");
  });

  it("renders not found for an unknown report", () => {
    renderAt("/projects/p1/cohorts");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Page not found");
  });

  it("switches to Persian: rtl document, translated navigation", async () => {
    renderAt("/projects/p1/overview");
    fireEvent.click(screen.getByRole("button", { name: /^Switch language: فارسی$/ }));
    await screen.findByRole("heading", { level: 1, name: "نمای کلی" });
    expect(document.documentElement.dir).toBe("rtl");
    expect(document.documentElement.lang).toBe("fa");
    expect(localStorage.getItem("didban.locale")).toBe("fa");
  });
  it("range pills write ?range= and drop a custom range", () => {
    const router = renderAt("/projects/p1/overview?from=2026-01-01&to=2026-01-05");
    expect(screen.getByTestId("range").textContent).toContain("Custom");
    fireEvent.click(screen.getByRole("radio", { name: /^7 days$/ }));
    expect(router.state.location.search).toBe("?range=7d");
    expect(screen.getByTestId("range").textContent).toContain("Last 7 days");
  });
});
