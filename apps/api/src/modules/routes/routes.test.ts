import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "../../test-support/reset-db.js";
import { call, seedTwoTenants } from "../../test-support/tenant-fixture.js";
import { startTestApp } from "../../test-support/test-app.js";

let t: Awaited<ReturnType<typeof startTestApp>>;
let tenants: Awaited<ReturnType<typeof seedTwoTenants>>;
let routes: string;

beforeEach(async () => {
  await resetDb();
  t = await startTestApp();
  tenants = await seedTwoTenants(t.sql);
  routes = `/projects/${tenants.ids.projectA}/routes`;
});
afterEach(() => t.close());

const owner = (method: string, url: string, body?: object) =>
  call(t, method, url, tenants.cookies.ownerA, body);
const add = (pattern: string, position?: number) => owner("POST", routes, { pattern, position });
const listed = async (): Promise<string[]> =>
  (await owner("GET", routes))
    .json()
    .routes.map((r: { position: number; pattern: string }) => `${r.position}:${r.pattern}`);

describe("route templates CRUD (spec §10)", () => {
  it("appends by default and inserts at a position", async () => {
    const first = await add("/products/:id");
    expect(first.statusCode).toBe(201);
    expect(first.json()).toMatchObject({ position: 1, pattern: "/products/:id" });
    await add("/blog/*");
    expect((await add("/products/new", 1)).json().position).toBe(1);
    expect((await add("/zzz", 99)).json().position).toBe(4); // clamped to the end
    expect(await listed()).toEqual(["1:/products/new", "2:/products/:id", "3:/blog/*", "4:/zzz"]);
  });

  it("moves, renames and deletes by ID; positions stay 1..n", async () => {
    const a = (await add("/a")).json().id;
    await add("/b");
    const c = (await add("/c")).json().id;
    const moved = await owner("PATCH", `${routes}/${c}`, { position: 1 });
    expect(moved.json()).toMatchObject({ id: c, position: 1, pattern: "/c" });
    const renamed = await owner("PATCH", `${routes}/${a}`, { pattern: "/a/:id" });
    expect(renamed.json()).toMatchObject({ id: a, position: 2, pattern: "/a/:id" });
    expect((await owner("DELETE", `${routes}/${c}`)).statusCode).toBe(204);
    expect(await listed()).toEqual(["1:/a/:id", "2:/b"]);
    expect((await owner("DELETE", `${routes}/${c}`)).statusCode).toBe(404);
    const stored = await t.sql`SELECT position, pattern FROM route_templates ORDER BY position`;
    expect(stored).toEqual([
      { position: 1, pattern: "/a/:id" },
      { position: 2, pattern: "/b" },
    ]);
  });
});

describe("route template rules (spec §7 step 6, §11)", () => {
  it("rejects bad syntax and raw regex (400), duplicates (409)", async () => {
    const bad = ["products", "/a/*/b", "/(a+)+$", "/a/:1x", "/a b", `/${"a".repeat(200)}`];
    for (const pattern of bad) {
      expect([pattern, (await add(pattern)).statusCode]).toEqual([pattern, 400]);
    }
    expect((await add("/x")).statusCode).toBe(201);
    const dup = await add("/x");
    expect([dup.statusCode, dup.json().error.code]).toEqual([409, "ROUTE_TEMPLATE_EXISTS"]);
    const id = (await add("/y")).json().id;
    expect((await owner("PATCH", `${routes}/${id}`, { pattern: "/x" })).statusCode).toBe(409);
    expect((await owner("PATCH", `${routes}/${id}`, {})).statusCode).toBe(400);
  });

  it("caps a project at 200 templates (409)", async () => {
    const values = Array.from({ length: 200 }, (_, i) => ({
      projectId: tenants.ids.projectA,
      position: i + 1,
      pattern: `/p${i}`,
    }));
    await t.sql`INSERT INTO route_templates ${t.sql(values)}`;
    const full = await add("/one-more");
    expect([full.statusCode, full.json().error.code]).toEqual([409, "ROUTE_TEMPLATE_LIMIT"]);
  });

  it("audits each change with field names only, never the pattern", async () => {
    const id = (await add("/secret-ish/:id")).json().id;
    await owner("PATCH", `${routes}/${id}`, { pattern: "/other" });
    await owner("DELETE", `${routes}/${id}`);
    const rows = await t.sql`
      SELECT action, target_type, target_id, details::text AS details FROM audit_logs
      WHERE action LIKE 'route_template.%' ORDER BY id`;
    expect(rows.map((r) => r.action)).toEqual([
      "route_template.created",
      "route_template.updated",
      "route_template.deleted",
    ]);
    expect(rows.every((r) => r.targetType === "route_template" && r.targetId === id)).toBe(true);
    expect(rows.map((r) => r.details).join()).not.toMatch(/secret|other/);
  });
});
