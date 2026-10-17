import { hash } from "@node-rs/argon2";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "../../test-support/reset-db.js";
import { sessionFrom, startTestApp } from "../../test-support/test-app.js";
import { createOwner } from "../users/create-owner.js";
import { ARGON2_PARAMS } from "./password-hasher.js";

const EMAIL = "owner@heliumpark.test";
const PASSWORD = "correct horse battery";
let t: Awaited<ReturnType<typeof startTestApp>>;

const login = (password = PASSWORD, headers: Record<string, string> = {}) =>
  t.post("/auth/login", { email: EMAIL, password }, headers);
const me = (cookie: string) => t.get("/auth/me", { cookie });

beforeEach(async () => {
  await resetDb();
  t = await startTestApp();
  await createOwner(t.sql, { email: EMAIL, password: PASSWORD, organizationName: "HeliumPark" });
});
afterEach(() => t.close());

describe("login (spec §11)", () => {
  it("sets an HttpOnly SameSite=Lax session cookie and resolves the user", async () => {
    const res = await login();
    expect(res.statusCode).toBe(200);
    expect(res.json().user).toMatchObject({ email: EMAIL, isPlatformAdmin: false });
    expect(res.headers["set-cookie"]).toMatch(/^sid=[\w-]{43}; Path=\/; HttpOnly; SameSite=Lax;/);
    expect((await me(sessionFrom(res))).json().user.email).toBe(EMAIL);
    const [row] = await t.sql`SELECT token_hash, ua_label FROM auth_sessions`;
    expect(row?.tokenHash).toHaveLength(32);
    expect(row?.uaLabel).toBe("Other on Other"); // light-my-request UA
  });

  it("answers unknown account and wrong password identically, paying the hash cost for both", async () => {
    const timed = async (body: object) => {
      const start = performance.now();
      const res = await t.post("/auth/login", body);
      return { res, ms: performance.now() - start };
    };
    const wrong = await timed({ email: EMAIL, password: "wrong horse battery" });
    const unknown = await timed({
      email: "nobody@heliumpark.test",
      password: "wrong horse battery",
    });
    expect(unknown.res.statusCode).toBe(401);
    const strip = (body: { error: object }) => ({ ...body.error, requestId: undefined });
    expect(strip(unknown.res.json())).toEqual(strip(wrong.res.json()));
    expect(unknown.res.json().error.code).toBe("INVALID_CREDENTIALS");
    expect(unknown.ms).toBeGreaterThan(wrong.ms * 0.4); // Argon2 ran for the unknown account too
  });

  it("rotates the session: the cookie the browser had before login stops working", async () => {
    const first = sessionFrom(await login());
    const second = sessionFrom(await login(PASSWORD, { cookie: first }));
    expect(second).not.toBe(first);
    expect((await me(first)).statusCode).toBe(401);
    expect((await me(second)).statusCode).toBe(200);
  });
});

describe("login hardening", () => {
  it("rate-limits the (IP, account) pair after 5 failures with Retry-After", async () => {
    for (let i = 0; i < 5; i += 1)
      expect((await login("wrong horse battery")).statusCode).toBe(401);
    const blocked = await login();
    expect(blocked.statusCode).toBe(429);
    expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0);
  });

  it("upgrades a hash made with weaker parameters on login", async () => {
    const weak = await hash(PASSWORD, { ...ARGON2_PARAMS, memoryCost: 8192 });
    await t.sql`UPDATE users SET password_hash = ${weak}`;
    expect((await login()).statusCode).toBe(200);
    const [user] = await t.sql`SELECT password_hash FROM users`;
    expect(user?.passwordHash).toMatch(/m=19456,t=2,p=1/);
  });

  it("rejects malformed bodies with the contract error", async () => {
    const res = await t.post("/auth/login", { email: "not-an-email", password: PASSWORD });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("VALIDATION_FAILED");
  });
});

describe("sessions", () => {
  it("requires a session on non-public routes", async () => {
    expect((await t.get("/auth/me")).statusCode).toBe(401);
    expect((await me("sid=not-a-token")).statusCode).toBe(401);
    expect((await t.get("/health/live")).statusCode).toBe(200);
  });

  it("expires after 7 idle days and after 30 days absolute", async () => {
    const idle = sessionFrom(await login());
    await t.sql`UPDATE auth_sessions SET last_seen_at = now() - interval '7 days 1 minute'`;
    expect((await me(idle)).statusCode).toBe(401);
    const old = sessionFrom(await login());
    await t.sql`UPDATE auth_sessions SET expires_at = now() - interval '1 second'`;
    expect((await me(old)).statusCode).toBe(401);
  });

  it("slides last_seen_at at most once per 5 minutes", async () => {
    const cookie = sessionFrom(await login());
    await t.sql`UPDATE auth_sessions SET last_seen_at = now() - interval '10 minutes'`;
    await me(cookie);
    const [row] =
      await t.sql`SELECT now() - last_seen_at < interval '1 minute' AS fresh FROM auth_sessions`;
    expect(row?.fresh).toBe(true);
  });

  it("logout revokes only this session; logout-all revokes every session", async () => {
    const a = sessionFrom(await login());
    const b = sessionFrom(await login());
    expect((await t.post("/auth/logout", {}, { cookie: a })).statusCode).toBe(204);
    expect((await me(a)).statusCode).toBe(401);
    expect((await me(b)).statusCode).toBe(200);
    const c = sessionFrom(await login());
    const out = await t.post("/auth/logout-all", {}, { cookie: c });
    expect(out.headers["set-cookie"]).toMatch(/^sid=; .*Max-Age=0/);
    expect((await me(b)).statusCode).toBe(401);
    expect((await me(c)).statusCode).toBe(401);
  });
});
