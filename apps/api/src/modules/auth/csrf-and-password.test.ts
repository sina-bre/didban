import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "../../test-support/reset-db.js";
import { sessionFrom, startTestApp } from "../../test-support/test-app.js";
import { createOwner } from "../users/create-owner.js";

const EMAIL = "owner@another.test";
const PASSWORD = "correct horse battery";
const NEW_PASSWORD = "a much better passphrase";
let t: Awaited<ReturnType<typeof startTestApp>>;

const body = JSON.stringify({ email: EMAIL, password: PASSWORD });
const rawLogin = (headers: Record<string, string>) =>
  t.send({ method: "POST", url: "/api/v1/auth/login", payload: body, headers });

beforeEach(async () => {
  await resetDb();
  t = await startTestApp();
  await createOwner(t.sql, { email: EMAIL, password: PASSWORD, organizationName: "Another" });
});
afterEach(() => t.close());

describe("CSRF origin check (spec §11, ADR 0009)", () => {
  const json = { "content-type": "application/json" };

  it("rejects a foreign Origin and a request with no origin signal", async () => {
    const foreign = await rawLogin({ ...json, origin: "https://evil.test" });
    expect(foreign.statusCode).toBe(403);
    expect(foreign.json().error.code).toBe("CSRF_REJECTED");
    expect((await rawLogin(json)).statusCode).toBe(403);
    expect((await rawLogin({ ...json, "sec-fetch-site": "cross-site" })).statusCode).toBe(403);
  });

  it("accepts the public origin or Sec-Fetch-Site: same-origin", async () => {
    expect((await rawLogin({ ...json, origin: "http://localhost:5173" })).statusCode).toBe(200);
    expect((await rawLogin({ ...json, "sec-fetch-site": "same-origin" })).statusCode).toBe(200);
  });

  it("requires a JSON content type (form posts cannot be forged)", async () => {
    const form = await rawLogin({
      origin: "http://localhost:5173",
      "content-type": "application/x-www-form-urlencoded",
    });
    expect(form.statusCode).toBe(415);
  });

  it("does not apply to safe methods", async () => {
    const res = await t.get("/health/live", { origin: "https://evil.test" });
    expect(res.statusCode).toBe(200);
  });
});

describe("change password", () => {
  const change = (cookie: string, currentPassword: string, newPassword: string) =>
    t.post("/auth/password", { currentPassword, newPassword }, { cookie });

  it("keeps this session, revokes all others, and the new password works", async () => {
    const current = sessionFrom(await t.post("/auth/login", { email: EMAIL, password: PASSWORD }));
    const other = sessionFrom(await t.post("/auth/login", { email: EMAIL, password: PASSWORD }));
    expect((await change(current, PASSWORD, NEW_PASSWORD)).statusCode).toBe(204);
    expect((await t.get("/auth/me", { cookie: current })).statusCode).toBe(200);
    expect((await t.get("/auth/me", { cookie: other })).statusCode).toBe(401);
    const relogin = await t.post("/auth/login", { email: EMAIL, password: NEW_PASSWORD });
    expect(relogin.statusCode).toBe(200);
  });

  it("refuses a wrong current password and a policy-violating new one", async () => {
    const cookie = sessionFrom(await t.post("/auth/login", { email: EMAIL, password: PASSWORD }));
    expect((await change(cookie, "wrong horse battery", NEW_PASSWORD)).statusCode).toBe(401);
    const common = await change(cookie, PASSWORD, "unbelievable");
    expect(common.json().error.code).toBe("PASSWORD_TOO_COMMON");
    expect((await change(cookie, PASSWORD, "short")).json().error.code).toBe("PASSWORD_TOO_SHORT");
  });
});
