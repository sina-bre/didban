import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "../../test-support/reset-db.js";
import { call, seedTwoTenants, statusOf } from "../../test-support/tenant-fixture.js";
import { startTestApp } from "../../test-support/test-app.js";

let t: Awaited<ReturnType<typeof startTestApp>>;
let tenants: Awaited<ReturnType<typeof seedTwoTenants>>;

beforeEach(async () => {
  await resetDb();
  t = await startTestApp();
  tenants = await seedTwoTenants(t.sql);
});
afterEach(() => t.close());

const logOf = (orgId: string, query = "") => `/organizations/${orgId}/audit-log${query}`;

describe("audit log: recording (spec §11)", () => {
  it("records actor, action, target, request ID and truncated IP of a change", async () => {
    const url = `/projects/${tenants.ids.projectA}`;
    const res = await call(t, "PATCH", url, tenants.cookies.ownerA, { retentionDays: 30 });
    const log = await call(t, "GET", logOf(tenants.ids.orgA), tenants.cookies.adminA);
    expect(log.statusCode).toBe(200);
    expect(log.json().entries).toEqual([
      expect.objectContaining({
        action: "project.updated",
        actor: { id: tenants.ids.ownerA, email: "a@helium.test" },
        projectId: tenants.ids.projectA,
        target: { type: "project", id: tenants.ids.projectA },
        details: { fields: ["retentionDays"] },
        requestId: res.headers["x-request-id"],
        ipPrefix: "127.0.0.0/24",
      }),
    ]);
  });

  it("a refused change leaves no audit row (same transaction)", async () => {
    const envs = `/projects/${tenants.ids.projectA}/environments`;
    const { ownerA } = tenants.cookies;
    expect(await statusOf(t, "POST", envs, ownerA, { name: "production" })).toBe(201);
    expect(await statusOf(t, "POST", envs, ownerA, { name: "production" })).toBe(409);
    const actions = (await call(t, "GET", logOf(tenants.ids.orgA), ownerA)).json().entries;
    expect(actions.map((e: { action: string }) => e.action)).toEqual(["environment.created"]);
  });

  it("revoking a key twice records one revocation", async () => {
    const { ownerA } = tenants.cookies;
    const project = `/projects/${tenants.ids.projectA}`;
    const env = (await call(t, "POST", `${project}/environments`, ownerA, { name: "prod" })).json();
    const keyUrl = `${project}/environments/${env.id}/keys`;
    const key = (await call(t, "POST", keyUrl, ownerA, { kind: "write_browser" })).json();
    await call(t, "DELETE", `${project}/keys/${key.id}`, ownerA);
    await call(t, "DELETE", `${project}/keys/${key.id}`, ownerA);
    const entries = (await call(t, "GET", logOf(tenants.ids.orgA), ownerA)).json().entries;
    expect(entries.map((e: { action: string }) => e.action)).toEqual([
      "api_key.revoked",
      "api_key.created",
      "environment.created",
    ]);
    expect(entries[1].details).toEqual({ kind: "write_browser", prefix: key.prefix });
  });
});

describe("audit log: reading (spec §11)", () => {
  it("pages newest first with a keyset cursor", async () => {
    const { ownerA } = tenants.cookies;
    for (const days of [30, 60, 90]) {
      await call(t, "PATCH", `/projects/${tenants.ids.projectA}`, ownerA, { retentionDays: days });
    }
    const first = (await call(t, "GET", logOf(tenants.ids.orgA, "?limit=2"), ownerA)).json();
    expect(first.entries).toHaveLength(2);
    const next = logOf(tenants.ids.orgA, `?limit=2&before=${first.nextBefore}`);
    const second = (await call(t, "GET", next, ownerA)).json();
    expect(second.entries).toHaveLength(1);
    expect(second.nextBefore).toBeNull();
    expect(BigInt(second.entries[0].id)).toBeLessThan(BigInt(first.entries[1].id));
    expect(await statusOf(t, "GET", logOf(tenants.ids.orgA, "?limit=500"), ownerA)).toBe(400);
  });

  it("owners and admins read it; members and viewers get 403; other orgs 404", async () => {
    const { memberA, viewerA, ownerB } = tenants.cookies;
    expect(await statusOf(t, "GET", logOf(tenants.ids.orgA), memberA)).toBe(403);
    expect(await statusOf(t, "GET", logOf(tenants.ids.orgA), viewerA)).toBe(403);
    expect(await statusOf(t, "GET", logOf(tenants.ids.orgA), ownerB)).toBe(404);
  });
});
