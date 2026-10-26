import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiError, fakeApi } from "./fake-api";
import { me, PROJECT, signedIn } from "./fixtures";
import { renderApp } from "./render-app";

const overview = `/projects/${PROJECT}/overview`;
const type = (label: RegExp | string, value: string) =>
  fireEvent.input(screen.getByLabelText(label), { target: { value } });

async function signIn(path: string, password = "correct horse battery") {
  const result = renderApp(path);
  await screen.findByRole("heading", { name: "Sign in" }, { timeout: 5000 });
  type("Email", " Owner@Example.com ");
  type("Password", password);
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  return result;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("/login", () => {
  it("signs in with the normalized email and returns to the path it came from", async () => {
    const calls = fakeApi({ ...signedIn(), "POST /auth/login": me() });
    const { router } = await signIn(`/login?next=${encodeURIComponent(`${overview}?range=7d`)}`);
    await waitFor(() => expect(router.state.location.pathname).toBe(overview));
    expect(router.state.location.search).toBe("?range=7d");
    const login = calls.find((c) => c.url.pathname === "/api/v1/auth/login");
    expect(login?.body).toEqual({ email: "owner@example.com", password: "correct horse battery" });
  });

  it("never follows a next that leaves the origin", async () => {
    fakeApi({ ...signedIn(), "POST /auth/login": me() });
    const { router } = await signIn("/login?next=//evil.example/x");
    await waitFor(() => expect(router.state.location.pathname).toBe(overview)); // via /projects
  });

  it("wrong password: an announced message, no redirect, the form stays", async () => {
    fakeApi({ "POST /auth/login": () => apiError(401, "INVALID_CREDENTIALS") });
    const { router } = await signIn("/login");
    expect((await screen.findByRole("alert")).textContent).toBe("Email or password is incorrect.");
    expect(router.state.location.pathname).toBe("/login");
  });

  it("rate limited and unknown failures have their own messages", async () => {
    fakeApi({ "POST /auth/login": () => apiError(429, "RATE_LIMITED") });
    await signIn("/login");
    expect((await screen.findByRole("alert")).textContent).toContain("Too many attempts");
    cleanup();
    fakeApi({ "POST /auth/login": () => apiError(500, "INTERNAL_ERROR") });
    await signIn("/login");
    expect((await screen.findByRole("alert")).textContent).toContain("req-test");
  });

  it("validates before sending: no request for an empty form", async () => {
    const calls = fakeApi({});
    renderApp("/login");
    fireEvent.click(await screen.findByRole("button", { name: "Sign in" }, { timeout: 5000 }));
    expect(await screen.findByText("Enter a valid email address.")).toBeTruthy();
    expect(screen.getByText("Enter your password.")).toBeTruthy();
    expect(screen.getByLabelText("Email").getAttribute("aria-invalid")).toBe("true");
    expect(calls).toEqual([]);
  });

  it("a temporary password goes to /set-password first, keeping the return path", async () => {
    fakeApi({ ...signedIn(), "POST /auth/login": me(true) });
    const { router } = await signIn(`/login?next=${encodeURIComponent(overview)}`);
    await screen.findByRole("heading", { name: "Choose your password" }, { timeout: 5000 });
    expect(router.state.location.search).toBe(`?next=${encodeURIComponent(overview)}`);
  });
});

describe("auth guard", () => {
  it("a signed-in user with a temporary password cannot reach a report", async () => {
    fakeApi({ ...signedIn(), "GET /auth/me": me(true) });
    const { router } = renderApp(overview);
    await waitFor(() => expect(router.state.location.pathname).toBe("/set-password"));
    expect(router.state.location.search).toBe(`?next=${encodeURIComponent(overview)}`);
  });
});
