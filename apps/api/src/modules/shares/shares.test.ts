import { createHash } from "node:crypto";
import { MAX_ACTIVE_SHARE_LINKS } from "@didban/contracts";
import { afterEach, beforeEach, expect, it } from "vitest";
import { resetDb } from "../../test-support/reset-db.js";
import { seedVisit } from "../../test-support/seed-stats.js";
import { bodyWithoutRequestId, call, seedTwoTenants } from "../../test-support/tenant-fixture.js";
import { startTestApp } from "../../test-support/test-app.js";

let t: Awaited<ReturnType<typeof startTestApp>>;
let tenants: Awaited<ReturnType<typeof seedTwoTenants>>;
let shares: string;

beforeEach(async () => {
  await resetDb();
  t = await startTestApp();
  tenants = await seedTwoTenants(t.sql);
  shares = `/projects/${tenants.ids.projectA}/shares`;
});
afterEach(() => t.close());

const RANGE = "from=2026-10-05T00:00:00Z&to=2026-10-12T00:00:00Z";
const view = (token: string | undefined, path: string) =>
  t.send({
    method: "GET",
    url: `/api/v1/share${path}`,
    headers: token ? { "x-share-token": token } : {},
  });

it("share links: admins create (token once, stored hashed), viewers cannot, audit", async () => {
  const { ownerA, viewerA } = tenants.cookies;
  expect((await call(t, "POST", shares, viewerA, { label: "x" })).statusCode).toBe(403);
  const created = await call(t, "POST", shares, ownerA, { label: "Board" });
  expect(created.statusCode).toBe(201);
  const { id, token } = created.json();
  expect(token).toMatch(/^dsh_[A-Za-z0-9_-]{43}$/);
  const [row] = await t.sql`SELECT token_hash FROM share_links WHERE id = ${id}`;
  expect(row?.tokenHash).toEqual(createHash("sha256").update(token).digest());
  const listed = (await call(t, "GET", shares, ownerA)).json().shareLinks;
  expect(listed).toEqual([expect.not.objectContaining({ token: expect.anything() })]);
  const actions = await t.sql`SELECT action FROM audit_logs WHERE target_type = 'share_link'`;
  expect(actions.map((a) => a.action)).toEqual(["share_link.created"]);
});

it("share view: one project, enumerated reports only, revocation and expiry end access", async () => {
  const { ownerA } = tenants.cookies;
  const [env] = await t.sql<{ id: string }[]>`
    INSERT INTO environments (project_id, name) VALUES (${tenants.ids.projectA}, 'production') RETURNING id`;
  await seedVisit(
    t.sql,
    { projectId: tenants.ids.projectA, environmentId: env?.id ?? "" },
    {
      visitor: 1,
      at: "2026-10-06T09:00:00Z",
      pages: ["/"],
    },
  );
  const { id, token } = (await call(t, "POST", shares, ownerA, { label: "Board" })).json();
  expect((await view(token, "")).json()).toEqual({
    projectName: "heliumpark",
    label: "Board",
    timezone: "UTC",
  });
  const overview = await view(token, `/stats/overview?${RANGE}`);
  expect(overview.json().metrics.visitors.value).toBe(1);
  expect((await view(token, `/stats/pages?${RANGE}&view=entry`)).statusCode).toBe(200);
  for (const hidden of ["data-health", "realtime", "export.csv", "constructor", "__proto__"]) {
    expect((await view(token, `/stats/${hidden}?${RANGE}`)).statusCode).toBe(404);
  }
  expect((await view(token, `/stats/overview?from=x`)).statusCode).toBe(400);
  const missing = await view(`dsh_${"A".repeat(43)}`, "");
  expect(missing.statusCode).toBe(404);
  expect((await view(undefined, "")).statusCode).toBe(404);
  await call(t, "DELETE", `${shares}/${id}`, ownerA);
  const revoked = await view(token, "");
  expect(bodyWithoutRequestId(revoked.json())).toEqual(bodyWithoutRequestId(missing.json()));
  const later = (
    await call(t, "POST", shares, ownerA, {
      label: "Soon",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    })
  ).json();
  expect((await view(later.token, "")).statusCode).toBe(200);
  await t.sql`UPDATE share_links SET expires_at = now() - interval '1 second' WHERE id = ${later.id}`;
  expect((await view(later.token, "")).statusCode).toBe(404);
});

it("share view: an archived project or another tenant's token reaches nothing of A", async () => {
  const { ownerA, ownerB } = tenants.cookies;
  const tokenB = (
    await call(t, "POST", `/projects/${tenants.ids.projectB}/shares`, ownerB, { label: "B" })
  ).json().token;
  expect((await view(tokenB, "")).json().projectName).toBe("another-website");
  const tokenA = (await call(t, "POST", shares, ownerA, { label: "A" })).json().token;
  await t.sql`UPDATE projects SET archived_at = now() WHERE id = ${tenants.ids.projectA}`;
  expect((await view(tokenA, "")).statusCode).toBe(404);
});

it("share links: at most 20 active per project", async () => {
  const { ownerA } = tenants.cookies;
  for (let i = 0; i < MAX_ACTIVE_SHARE_LINKS; i++) {
    expect((await call(t, "POST", shares, ownerA, { label: `l${i}` })).statusCode).toBe(201);
  }
  const over = await call(t, "POST", shares, ownerA, { label: "one more" });
  expect([over.statusCode, over.json().error.code]).toEqual([409, "SHARE_LINK_LIMIT_REACHED"]);
});
