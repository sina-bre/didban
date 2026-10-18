import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "../../test-support/reset-db.js";
import { seedProjectMember } from "../../test-support/seed-org.js";
import { call, seedTwoTenants, statusOf } from "../../test-support/tenant-fixture.js";
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

const preview = (body: object) =>
  call(t, "POST", `${routes}/preview`, tenants.cookies.ownerA, body);

describe("route preview (spec §10, §16)", () => {
  it("matches saved templates in position order, null when nothing matches", async () => {
    for (const pattern of ["/products/new", "/products/:id", "/blog/*"]) {
      await call(t, "POST", routes, tenants.cookies.ownerA, { pattern });
    }
    const paths = ["/products/new", "/products/42/", "/blog", "/blog/a/b", "/"];
    const res = await preview({ paths });
    expect(res.statusCode).toBe(200);
    expect(res.json().results.map((r: { template: string | null }) => r.template)).toEqual([
      "/products/new",
      "/products/:id",
      "/blog/*",
      "/blog/*",
      null,
    ]);
  });

  it("tries unsaved patterns without storing them", async () => {
    const res = await preview({ paths: ["/u/7/edit"], patterns: ["/u/:id", "/u/:id/edit"] });
    expect(res.json().results).toEqual([{ path: "/u/7/edit", template: "/u/:id/edit" }]);
    const [row] = await t.sql`SELECT count(*)::int AS n FROM route_templates`;
    expect(row?.n).toBe(0);
    expect((await preview({ paths: ["/a"], patterns: ["/(a+)+"] })).statusCode).toBe(400);
  });

  it("stays fast on hostile inputs and enforces the limits", async () => {
    const long = `/${"a/".repeat(600)}`.slice(0, 1024);
    const started = performance.now();
    const res = await preview({ paths: Array(20).fill(long), patterns: ["/a/*", "/:x/:y/b"] });
    expect(res.statusCode).toBe(200);
    expect(performance.now() - started).toBeLessThan(500);
    expect((await preview({ paths: Array(21).fill("/a") })).statusCode).toBe(400);
    expect((await preview({ paths: ["no-slash"] })).statusCode).toBe(400);
  });
});

describe("route template permissions (spec §11)", () => {
  it("project admins and org admins manage; viewers get 403", async () => {
    const { projectA, orgA, memberA } = tenants.ids;
    await seedProjectMember(t.sql, projectA, orgA, memberA, "project_admin");
    const { memberA: projectAdmin, adminA, viewerA } = tenants.cookies;
    expect(await statusOf(t, "POST", routes, projectAdmin, { pattern: "/m" })).toBe(201);
    expect(await statusOf(t, "POST", routes, adminA, { pattern: "/a" })).toBe(201);
    const attempts: [string, string, object][] = [
      ["GET", routes, {}],
      ["POST", routes, { pattern: "/v" }],
      ["POST", `${routes}/preview`, { paths: ["/v"] }],
    ];
    for (const [method, url, body] of attempts) {
      const status = await statusOf(t, method, url, viewerA, body);
      expect([method, url, status]).toEqual([method, url, 403]);
    }
  });
});
