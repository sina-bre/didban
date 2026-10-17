import { MAX_ACTIVE_KEYS_PER_ENVIRONMENT } from "@didban/contracts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "../../test-support/reset-db.js";
import { call, seedTwoTenants, statusOf } from "../../test-support/tenant-fixture.js";
import { startTestApp } from "../../test-support/test-app.js";
import { hashApiKeyToken } from "./api-key-token.js";

let t: Awaited<ReturnType<typeof startTestApp>>;
let tenants: Awaited<ReturnType<typeof seedTwoTenants>>;
let envA: string;

beforeEach(async () => {
  await resetDb();
  t = await startTestApp();
  tenants = await seedTwoTenants(t.sql);
  const env = await call(
    t,
    "POST",
    `/projects/${tenants.ids.projectA}/environments`,
    tenants.cookies.ownerA,
    {
      name: "production",
    },
  );
  envA = env.json().id;
});
afterEach(() => t.close());

const createUrl = () => `/projects/${tenants.ids.projectA}/environments/${envA}/keys`;
const listUrl = () => `/projects/${tenants.ids.projectA}/keys`;

describe("api keys (spec §9.1)", () => {
  it("shows the token once and stores only its SHA-256", async () => {
    const res = await call(t, "POST", createUrl(), tenants.cookies.adminA, {
      kind: "write_browser",
    });
    expect(res.statusCode).toBe(201);
    const { token, prefix } = res.json();
    expect(token).toMatch(/^dpk_[0-9a-f]{12}_[A-Za-z0-9_-]{43}$/);
    expect(token.startsWith(prefix)).toBe(true);
    const [row] = await t.sql`SELECT secret_hash, created_by FROM api_keys`;
    expect(Buffer.compare(row?.secretHash, hashApiKeyToken(token))).toBe(0);
    expect(row?.createdBy).toBe(tenants.ids.adminA);
    const list = await call(t, "GET", listUrl(), tenants.cookies.adminA);
    expect(list.json().keys).toHaveLength(1);
    expect(JSON.stringify(list.json())).not.toContain(token.slice(17));
  });

  it("revokes idempotently and frees a slot under the active-key cap", async () => {
    const { ownerA } = tenants.cookies;
    let last = "";
    for (let i = 0; i < MAX_ACTIVE_KEYS_PER_ENVIRONMENT; i += 1) {
      last = (await call(t, "POST", createUrl(), ownerA, { kind: "write_server" })).json().id;
    }
    expect(await statusOf(t, "POST", createUrl(), ownerA, { kind: "write_server" })).toBe(409);
    const revoke = `${listUrl()}/${last}`;
    expect(await statusOf(t, "DELETE", revoke, ownerA)).toBe(204);
    expect(await statusOf(t, "DELETE", revoke, ownerA)).toBe(204);
    expect(await statusOf(t, "POST", createUrl(), ownerA, { kind: "write_server" })).toBe(201);
  });

  it("viewers get 403; keys of A are unreachable through B's project", async () => {
    expect(await statusOf(t, "GET", listUrl(), tenants.cookies.viewerA)).toBe(403);
    const key = (
      await call(t, "POST", createUrl(), tenants.cookies.ownerA, { kind: "write_browser" })
    ).json();
    const { projectB } = tenants.ids;
    const { ownerB } = tenants.cookies;
    expect(await statusOf(t, "DELETE", `/projects/${projectB}/keys/${key.id}`, ownerB)).toBe(404);
    const mixed = `/projects/${projectB}/environments/${envA}/keys`;
    expect(await statusOf(t, "POST", mixed, ownerB, { kind: "write_server" })).toBe(404);
    const [row] =
      await t.sql`SELECT count(*)::int AS n, count(revoked_at)::int AS revoked FROM api_keys`;
    expect(row).toEqual({ n: 1, revoked: 0 });
  });
});
