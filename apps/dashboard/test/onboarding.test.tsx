import type { Environment } from "@didban/contracts";
import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CHECK_TIMEOUT_MS } from "../src/features/integration/use-live-check";
import { type Call, fakeApi } from "./fake-api";
import { ORG, project, signedIn } from "./fixtures";
import { renderApp } from "./render-app";
import { dataHealth } from "./report-fixtures";
import { environment } from "./settings-fixtures";
import { realtime } from "./stats-fixtures";

// Spec §13.4: the wizard works end to end on one page; the live check names the likely cause.
const NEW = "00000000-0000-4000-8000-0000000000a9";
const TOKEN = `dpk_e2e000000009_${"w".repeat(43)}`;
const wait = { timeout: 8000 };
const env: Environment = {
  ...environment,
  projectId: NEW,
  allowedOrigins: ["https://blog.example"],
};
const quiet = { ...realtime, activeVisitors: 0, recentEvents: [] };
const rejected = {
  ...dataHealth,
  rejections: [],
  rejectedOrigins: [],
  recentRejections: [
    { at: env.createdAt, code: "ORIGIN_NOT_ALLOWED", origin: "https://www.blog.example" },
  ],
};

function wizardApi(live: object) {
  return fakeApi({
    ...signedIn(),
    [`POST /organizations/${ORG}/projects`]: () => ({
      status: 201,
      body: { ...project(NEW), name: "Blog" },
    }),
    [`GET /projects/${NEW}`]: project(NEW),
    [`POST /projects/${NEW}/environments`]: () => ({ status: 201, body: env }),
    [`GET /projects/${NEW}/environments`]: { environments: [env] },
    [`POST /projects/${NEW}/environments/${env.id}/keys`]: () => ({
      status: 201,
      body: {
        id: env.id,
        environmentId: env.id,
        kind: "write_browser",
        prefix: TOKEN.slice(0, 16),
        token: TOKEN,
        createdAt: env.createdAt,
        lastUsedAt: null,
        revokedAt: null,
      },
    }),
    [`GET /projects/${NEW}/stats/realtime`]: live,
    [`GET /projects/${NEW}/stats/data-health`]: rejected,
    [`PATCH /projects/${NEW}/environments/${env.id}`]: env,
  });
}

/** Project → environment → key, up to "I added the snippet". */
async function throughKey(calls: Call[]) {
  fireEvent.change(await screen.findByLabelText("Project name", {}, wait), {
    target: { value: "Blog" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create project" }));
  fireEvent.change(await screen.findByLabelText("Allowed origins", {}, wait), {
    target: { value: "https://blog.example" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create environment" }));
  fireEvent.click(await screen.findByRole("button", { name: "Create write key" }, wait));
  expect((await screen.findAllByText(new RegExp(TOKEN), {}, wait)).length).toBeGreaterThan(1);
  expect(
    calls.find((c) => c.method === "POST" && c.url.pathname.endsWith("/environments"))?.body,
  ).toMatchObject({
    name: "production",
    allowedOrigins: ["https://blog.example"],
  });
  fireEvent.click(screen.getByRole("button", { name: "I added the snippet" }));
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("onboarding wizard", () => {
  it("creates project, environment and key, then sees the first event", async () => {
    const calls = wizardApi(realtime);
    renderApp("/projects/new");
    await throughKey(calls);
    expect(await screen.findByText("First event received", {}, wait)).toBeTruthy();
    const check = calls.find((c) => c.url.pathname.endsWith("/stats/realtime"));
    expect(check?.url.searchParams.get("environmentId")).toBe(env.id);
  });

  it("after the timeout: names the rejected origin and allows it with one button", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const calls = wizardApi(quiet);
    renderApp("/projects/new");
    await throughKey(calls);
    await screen.findByText("Waiting for the first event…", {}, wait);
    await act(() => vi.advanceTimersByTimeAsync(CHECK_TIMEOUT_MS + 1000));
    const cause = "Events were rejected with ORIGIN_NOT_ALLOWED from https://www.blog.example.";
    expect(await screen.findByText(cause, {}, wait)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Allow https://www.blog.example" }));
    await waitFor(() =>
      expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({
        allowedOrigins: ["https://blog.example", "https://www.blog.example"],
      }),
    );
    expect(
      await screen.findByText("https://www.blog.example is now allowed", {}, wait),
    ).toBeTruthy();
  });

  it("an org member cannot open it: not found", async () => {
    fakeApi({
      ...signedIn(),
      "GET /organizations": {
        organizations: [{ id: ORG, name: "Acme", slug: "acme", role: "member" }],
      },
    });
    renderApp("/projects/new");
    expect(await screen.findByText("Page not found", {}, wait)).toBeTruthy();
  });
});
