import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiError, fakeApi } from "./fake-api";
import { me, PROJECT, signedIn } from "./fixtures";
import { renderApp } from "./render-app";

const overview = `/projects/${PROJECT}/overview`;
const type = (label: string, value: string) =>
  fireEvent.input(screen.getByLabelText(label), { target: { value } });

async function fill(current: string, next: string, confirm = next) {
  const result = renderApp(`/set-password?next=${encodeURIComponent(overview)}`);
  await screen.findByRole("heading", { name: "Choose your password" }, { timeout: 5000 });
  type("Temporary password", current);
  type("New password", next);
  type("Repeat the new password", confirm);
  fireEvent.click(screen.getByRole("button", { name: "Save password" }));
  return result;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("/set-password", () => {
  it("saves and continues to the return path, which the guard now lets through", async () => {
    let temporary = true; // like the server: the flag clears when the password is saved
    const calls = fakeApi({
      ...signedIn(),
      "GET /auth/me": () => ({ body: me(temporary) }),
      "POST /auth/password": () => {
        temporary = false;
        return { status: 204 };
      },
    });
    const { router } = await fill("TEMP-PASS-1234", "a long new passphrase");
    await waitFor(() => expect(router.state.location.pathname).toBe(overview));
    await screen.findByRole("heading", { level: 1, name: "Overview" }, { timeout: 5000 });
    const sent = calls.find((c) => c.url.pathname === "/api/v1/auth/password");
    expect(sent?.body).toEqual({
      currentPassword: "TEMP-PASS-1234",
      newPassword: "a long new passphrase",
    });
  });

  it("checks length and the repeat before sending", async () => {
    const calls = fakeApi({});
    await fill("TEMP", "short", "other");
    expect(await screen.findByText("Use at least 12 characters.")).toBeTruthy();
    expect(screen.getByText("The passwords do not match.")).toBeTruthy();
    expect(calls).toEqual([]);
  });

  it("explains the server's policy answer next to the new password", async () => {
    fakeApi({ "POST /auth/password": () => apiError(400, "PASSWORD_TOO_COMMON") });
    await fill("TEMP-PASS-1234", "password1234");
    const field = screen.getByLabelText("New password");
    await waitFor(() => expect(field.getAttribute("aria-invalid")).toBe("true"));
    expect(screen.getByText("This password is too common. Choose another one.")).toBeTruthy();
  });

  it("a wrong temporary password is marked on that field, not as a lost session", async () => {
    fakeApi({ "POST /auth/password": () => apiError(401, "INVALID_CREDENTIALS") });
    const { router } = await fill("WRONG-PASS-1", "a long new passphrase");
    expect(await screen.findByText("The temporary password is incorrect.")).toBeTruthy();
    expect(router.state.location.pathname).toBe("/set-password");
  });
});
