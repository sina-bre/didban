import { cleanup, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { fakeApi } from "./fake-api";
import { OTHER, PROJECT, signedIn } from "./fixtures";
import { renderApp } from "./render-app";

// The 5c pages in real Chrome with our CSS: fa/RTL, 360 px, touch targets, the switcher popover.
const overflows = () => document.documentElement.scrollWidth > innerWidth;
const box = (el: Element) => el.getBoundingClientRect();

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("login page", () => {
  it("fa at 360 px: right-aligned labels, LTR inputs, 44 px targets, no sideways scroll", async () => {
    await page.viewport(360, 740);
    fakeApi({});
    renderApp("/login", { locale: "fa" });
    await screen.findByRole("heading", { name: "ورود" }, { timeout: 5000 });
    const email = screen.getByLabelText("ایمیل");
    const label = screen.getByText("ایمیل", { selector: "label" });
    expect(getComputedStyle(email).direction).toBe("ltr");
    expect(box(label).right).toBeCloseTo(box(email).right, 0); // label starts at the right edge
    const submit = screen.getByRole("button", { name: "ورود" });
    expect(box(submit).height).toBeGreaterThanOrEqual(44);
    expect(box(email).height).toBeGreaterThanOrEqual(44);
    expect(overflows()).toBe(false);
  });

  it("keyboard only: Tab through the fields, Enter submits", async () => {
    const calls = fakeApi({
      "POST /auth/login": () => ({
        status: 401,
        body: { error: { code: "INVALID_CREDENTIALS", message: "x", requestId: "r" } },
      }),
    });
    renderApp("/login");
    await screen.findByRole("heading", { name: "Sign in" }, { timeout: 5000 });
    await userEvent.click(screen.getByLabelText("Email"));
    await userEvent.keyboard("owner@example.com");
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByLabelText("Password"));
    await userEvent.keyboard("wrong password{Enter}");
    expect((await screen.findByRole("alert")).textContent).toBe("Email or password is incorrect.");
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(1);
  });
});

describe("overview page", () => {
  it("fa at 360 px: switcher in the top bar, two KPI columns, no sideways scroll", async () => {
    await page.viewport(360, 740);
    fakeApi(signedIn());
    renderApp(`/projects/${PROJECT}/overview`, { locale: "fa" });
    await screen.findByRole("heading", { level: 1, name: "نمای کلی" }, { timeout: 5000 });
    const trigger = await screen.findByRole("button", { name: /تغییر سازمان و پروژه/ });
    expect(box(trigger).height).toBeGreaterThanOrEqual(44);
    const name = screen.getByText("didban", { selector: "header span span" });
    expect(getComputedStyle(name).display).toBe("none"); // the switcher takes its room on mobile
    const label = await screen.findByText(
      "نمایش در هر بازدید",
      { selector: "p" },
      { timeout: 5000 },
    );
    const kpis = label.closest(".grid") as HTMLElement;
    expect(getComputedStyle(kpis).gridTemplateColumns.split(" ")).toHaveLength(2);
    await waitFor(() => expect(overflows()).toBe(false));
  });

  it("the switcher opens as a popover and its link opens the other project", async () => {
    await page.viewport(1280, 800);
    fakeApi(signedIn());
    const { router } = renderApp(`/projects/${PROJECT}/overview`);
    await userEvent.click(
      await screen.findByRole("button", { name: /Acme \/ Shop/ }, { timeout: 5000 }),
    );
    const blog = await screen.findByRole("link", { name: "Blog" });
    await userEvent.click(blog);
    await waitFor(() => expect(router.state.location.pathname).toBe(`/projects/${OTHER}/overview`));
    expect(document.querySelector(":popover-open")).toBeNull();
  });
});
