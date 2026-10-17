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

const envsOf = (projectId: string) => `/projects/${projectId}/environments`;

describe("environments (spec §9.1)", () => {
  it("creates with normalized origins and CIDRs, then updates", async () => {
    const created = await call(t, "POST", envsOf(tenants.ids.projectA), tenants.cookies.adminA, {
      name: "production",
      allowedOrigins: ["https://HeliumPark.example/"],
      excludedCidrs: ["203.0.113.7", "10.0.0.0/8"],
    });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({
      projectId: tenants.ids.projectA,
      identityMode: "cookieless",
      allowedOrigins: ["https://heliumpark.example"],
      excludedCidrs: ["203.0.113.7/32", "10.0.0.0/8"],
      trackLocalhost: false,
    });
    const url = `${envsOf(tenants.ids.projectA)}/${created.json().id}`;
    const updated = await call(t, "PATCH", url, tenants.cookies.ownerA, {
      identityMode: "persistent",
    });
    expect(updated.json()).toMatchObject({ identityMode: "persistent", name: "production" });
  });

  it("rejects duplicates (409), bad origins and bad CIDRs (400)", async () => {
    const url = envsOf(tenants.ids.projectA);
    const { adminA } = tenants.cookies;
    expect(await statusOf(t, "POST", url, adminA, { name: "staging" })).toBe(201);
    expect(await statusOf(t, "POST", url, adminA, { name: "staging" })).toBe(409);
    expect(
      await statusOf(t, "POST", url, adminA, { name: "a", allowedOrigins: ["https://x.com/p"] }),
    ).toBe(400);
    expect(
      await statusOf(t, "POST", url, adminA, { name: "b", excludedCidrs: ["10.0.0.0/40"] }),
    ).toBe(400);
    expect(await statusOf(t, "POST", url, adminA, { name: "Prod" })).toBe(400);
  });

  it("a viewer lists environments but cannot create them", async () => {
    const url = envsOf(tenants.ids.projectA);
    await call(t, "POST", url, tenants.cookies.ownerA, { name: "production" });
    const list = await call(t, "GET", url, tenants.cookies.viewerA);
    expect(list.json().environments.map((e: { name: string }) => e.name)).toEqual(["production"]);
    expect(await statusOf(t, "POST", url, tenants.cookies.viewerA, { name: "x" })).toBe(403);
  });
});

describe("environments: tenant isolation (spec §11)", () => {
  it("A's environment cannot be changed through B's own project", async () => {
    const created = await call(t, "POST", envsOf(tenants.ids.projectA), tenants.cookies.ownerA, {
      name: "production",
    });
    const mixed = `${envsOf(tenants.ids.projectB)}/${created.json().id}`;
    const body = { trackLocalhost: true };
    expect(await statusOf(t, "PATCH", mixed, tenants.cookies.ownerB, body)).toBe(404);
    const [row] = await t.sql`SELECT track_localhost FROM environments`;
    expect(row?.trackLocalhost).toBe(false);
  });
});
