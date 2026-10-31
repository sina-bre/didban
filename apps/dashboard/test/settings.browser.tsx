import { cleanup, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { fakeApi } from "./fake-api";
import { ORG, PROJECT, signedIn } from "./fixtures";
import { renderApp } from "./render-app";
import { ENV, keys, MEMBER, settingsApi } from "./settings-fixtures";

// Stage 5e dialogs in real Chrome: one-time secrets (key token, share URL, temporary password),
// confirmations, and the settings pages in fa at 360 px.
const base = `/projects/${PROJECT}/settings`;
const wait = { timeout: 8000 };
const TOKEN = `dpk_0123456789ab_${"x".repeat(43)}`;
const SHARE = `dsh_${"s".repeat(43)}`;
const api = (extra = {}) => fakeApi({ ...signedIn(), ...settingsApi(), ...extra });
const overflows = () => document.documentElement.scrollWidth > innerWidth;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("one-time secrets", () => {
  it("a new browser key: token once, snippets with it, the capability table", async () => {
    const created = { ...keys.keys[0], token: TOKEN };
    const calls = api({
      [`POST /projects/${PROJECT}/environments/${ENV}/keys`]: () => ({
        status: 201,
        body: created,
      }),
    });
    renderApp(`${base}/keys`);
    await userEvent.click(await screen.findByRole("button", { name: "Create key" }, wait));
    const dialog = await screen.findByRole("dialog", { name: "Your new key" }, wait);
    expect(within(dialog).getByText(/stored only as a hash/)).toBeTruthy();
    const code = [...dialog.querySelectorAll("code")].map((el) => el.textContent).join(" ");
    expect(code).toContain(`data-write-key="${TOKEN}"`);
    expect(code).toContain(`writeKey: "${TOKEN}"`);
    expect(within(dialog).getByRole("table", { name: "What tracking collects" })).toBeTruthy();
    expect(calls.find((c) => c.method === "POST")?.body).toEqual({ kind: "write_browser" });
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect((dialog as HTMLDialogElement).open).toBe(false));
    expect(screen.queryByText(new RegExp(TOKEN))).toBeNull(); // gone with the dialog
  });

  it("a new share link: the URL carries the token in the fragment only", async () => {
    const link = {
      id: "00000000-0000-4000-8000-0000000000b2",
      label: "Investors",
      createdAt: "2026-10-20T10:00:00.000Z",
      expiresAt: null,
      revokedAt: null,
      token: SHARE,
    };
    const calls = api({
      [`POST /projects/${PROJECT}/shares`]: () => ({ status: 201, body: link }),
    });
    renderApp(`${base}/sharing`);
    await userEvent.type(await screen.findByLabelText("Label", {}, wait), "Investors");
    await userEvent.click(screen.getByRole("button", { name: "Create link" }));
    const dialog = await screen.findByRole("dialog", { name: "Your share link" }, wait);
    expect(within(dialog).getByText(`${location.origin}/share#${SHARE}`)).toBeTruthy();
    expect(calls.find((c) => c.method === "POST")?.body).toEqual({ label: "Investors" });
  });

  it("an owner creates a user and sees the temporary password once", async () => {
    const user = {
      userId: MEMBER,
      email: "new@example.com",
      role: "member",
      temporaryPassword: "TEMP-pass-123456",
    };
    const calls = api({
      [`POST /organizations/${ORG}/users`]: () => ({ status: 201, body: user }),
    });
    renderApp(`/organizations/${ORG}/settings/members`);
    const form = (await screen.findByRole("region", { name: "Create user" }, wait)) as HTMLElement;
    await userEvent.type(within(form).getByLabelText("Email"), "new@example.com");
    await userEvent.click(within(form).getByRole("button", { name: "Create user" }));
    const dialog = await screen.findByRole(
      "dialog",
      { name: "Password for new@example.com" },
      wait,
    );
    expect(within(dialog).getByText("TEMP-pass-123456")).toBeTruthy();
    expect(calls.find((c) => c.method === "POST")?.body).toEqual({
      email: "new@example.com",
      role: "member",
    });
  });
});

describe("confirmations", () => {
  it("revoking a key asks first, then sends DELETE for that key", async () => {
    const id = keys.keys[0]?.id;
    const calls = api({ [`DELETE /projects/${PROJECT}/keys/${id}`]: () => ({ status: 204 }) });
    renderApp(`${base}/keys`);
    await userEvent.click(
      await screen.findByRole("button", { name: "Revoke key dpk_0123456789ab" }, wait),
    );
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
    const dialog = screen.getByRole("dialog", { name: "Revoke dpk_0123456789ab?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Revoke" }));
    await waitFor(() => expect(calls.filter((c) => c.method === "DELETE")).toHaveLength(1));
  });
});

describe("fa at 360 px", () => {
  it.each(["environments", "audit"])("settings/%s: RTL, no page overflow", async (tab) => {
    await page.viewport(360, 740);
    api();
    renderApp(`${base}/${tab}`, { locale: "fa" });
    await screen.findByRole("navigation", { name: "تنظیمات" }, wait);
    await screen.findAllByText(tab === "environments" ? "production" : "203.0.113.0/24", {}, wait);
    expect(document.documentElement.dir).toBe("rtl");
    expect(overflows()).toBe(false);
  });
});
