import { MAX_GOALS } from "@didban/contracts";
import { afterEach, beforeEach, expect, it } from "vitest";
import { uuidV7 } from "../../domain/uuid-v7.js";
import { resetDb } from "../../test-support/reset-db.js";
import { seedVisit, type Target } from "../../test-support/seed-stats.js";
import { call, seedTwoTenants } from "../../test-support/tenant-fixture.js";
import { startTestApp } from "../../test-support/test-app.js";

let t: Awaited<ReturnType<typeof startTestApp>>;
let tenants: Awaited<ReturnType<typeof seedTwoTenants>>;
let target: Target;

beforeEach(async () => {
  await resetDb();
  t = await startTestApp();
  tenants = await seedTwoTenants(t.sql);
  const projectId = tenants.ids.projectA;
  const [env] = await t.sql<{ id: string }[]>`
    INSERT INTO environments (project_id, name) VALUES (${projectId}, 'production') RETURNING id`;
  target = { projectId, environmentId: env?.id ?? "" };
});
afterEach(() => t.close());

const goals = `/projects/${"{p}"}/goals`;
const url = (suffix = "") => goals.replace("{p}", target.projectId) + suffix;
const signup = { kind: "event", name: "Signed up", eventName: "signup" };

it("goals: admins manage, viewers read; audit keeps field names only", async () => {
  const { ownerA, viewerA } = tenants.cookies;
  expect((await call(t, "POST", url(), viewerA, signup)).statusCode).toBe(403);
  const created = await call(t, "POST", url(), ownerA, signup);
  expect(created.statusCode).toBe(201);
  const id = created.json().id;
  expect((await call(t, "POST", url(), ownerA, signup)).statusCode).toBe(409);
  const renamed = await call(t, "PATCH", url(`/${id}`), ownerA, { name: "Signup" });
  expect(renamed.json()).toMatchObject({ name: "Signup", eventName: "signup", pathPattern: null });
  const wrongKind = await call(t, "PATCH", url(`/${id}`), ownerA, { pathPattern: "/x" });
  expect(wrongKind.statusCode).toBe(400);
  expect((await call(t, "GET", url(), viewerA)).json().goals).toHaveLength(1);
  expect((await call(t, "DELETE", url(`/${id}`), ownerA)).statusCode).toBe(200);
  expect((await call(t, "DELETE", url(`/${id}`), ownerA)).statusCode).toBe(404);
  const audit =
    await t.sql`SELECT action, details FROM audit_logs WHERE target_type = 'goal' ORDER BY created_at`;
  expect(audit.map((a) => a.action)).toEqual(["goal.created", "goal.updated", "goal.deleted"]);
  expect(audit[1]?.details).toEqual({ fields: ["name"] });
});

it("goals: path patterns are checked, at most 50 per project", async () => {
  const { ownerA } = tenants.cookies;
  const bad = await call(t, "POST", url(), ownerA, {
    kind: "page",
    name: "x",
    pathPattern: "/a/(.*)",
  });
  expect(bad.statusCode).toBe(400);
  for (let i = 0; i < MAX_GOALS; i++) {
    const res = await call(t, "POST", url(), ownerA, {
      kind: "page",
      name: `g${i}`,
      pathPattern: `/p${i}`,
    });
    expect(res.statusCode).toBe(201);
  }
  const over = await call(t, "POST", url(), ownerA, {
    kind: "page",
    name: "one more",
    pathPattern: "/x",
  });
  expect([over.statusCode, over.json().error.code]).toEqual([409, "GOAL_LIMIT_REACHED"]);
});

async function serverPurchase(at: string, revenue: number, currency: string) {
  await t.sql`
    INSERT INTO events (project_id, environment_id, event_id, type, occurred_at, received_at,
      visitor_id, source, name, hostname, pathname, route, channel, revenue, currency)
    VALUES (${target.projectId}, ${target.environmentId}, ${uuidV7(Date.parse(at))}, 2, ${at}, ${at},
      ${Buffer.alloc(16, 9)}, 2, 'purchase', 'shop.example', '/checkout', '/checkout', 0, ${revenue}, ${currency})`;
}

it("goal stats: counts + revenue per currency incl. server events, rate from browser visitors", async () => {
  const { ownerA, viewerA } = tenants.cookies;
  await call(t, "POST", url(), ownerA, { kind: "event", name: "Purchase", eventName: "purchase" });
  await call(t, "POST", url(), ownerA, {
    kind: "page",
    name: "Product",
    pathPattern: "/products/:id",
  });
  await seedVisit(t.sql, target, {
    visitor: 1,
    at: "2026-10-06T09:00:00Z",
    pages: ["/products/1", "/products/2"],
    tracks: ["purchase"],
  });
  await seedVisit(t.sql, target, {
    visitor: 2,
    at: "2026-10-06T10:00:00Z",
    pages: ["/products", "/products/1/reviews"],
  });
  await seedVisit(t.sql, target, { visitor: 3, at: "2026-10-06T11:00:00Z", pages: ["/"] });
  await serverPurchase("2026-10-06T12:00:00Z", 19.9, "EUR");
  await serverPurchase("2026-10-06T13:00:00Z", 5.1, "EUR");
  await serverPurchase("2026-10-06T14:00:00Z", 10, "USD");
  const query = "from=2026-10-05T00:00:00Z&to=2026-10-12T00:00:00Z";
  const res = await call(t, "GET", `/projects/${target.projectId}/stats/goals?${query}`, viewerA);
  const [purchase, product] = res.json().goals;
  expect(purchase).toMatchObject({ conversions: 4, visitors: 1, conversionRate: 0.3333 });
  expect(purchase.revenue).toEqual([
    { currency: "EUR", amount: "25.00" },
    { currency: "USD", amount: "10.00" },
  ]);
  expect(product).toMatchObject({
    conversions: 2,
    visitors: 1,
    conversionRate: 0.3333,
    revenue: [],
  });
});

it("goal stats: a new or deleted goal shows at once, not after the 15 s report cache", async () => {
  const { ownerA } = tenants.cookies;
  const stats = `/projects/${target.projectId}/stats/goals?from=2026-10-05T00:00:00Z&to=2026-10-12T00:00:00Z`;
  expect((await call(t, "GET", stats, ownerA)).json().goals).toEqual([]);
  const created = await call(t, "POST", url(), ownerA, {
    kind: "event",
    name: "Join",
    eventName: "join",
  });
  expect(
    (await call(t, "GET", stats, ownerA)).json().goals.map((g: { name: string }) => g.name),
  ).toEqual(["Join"]);
  await call(t, "DELETE", `${url()}/${created.json().id}`, ownerA);
  expect((await call(t, "GET", stats, ownerA)).json().goals).toEqual([]);
});
