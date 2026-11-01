import { presetRange } from "@didban/contracts";
import { afterEach, beforeEach, expect, it } from "vitest";
import { resetDb } from "../../test-support/reset-db.js";
import { seedVisit } from "../../test-support/seed-stats.js";
import { call, seedTwoTenants } from "../../test-support/tenant-fixture.js";
import { startTestApp } from "../../test-support/test-app.js";

// ADR 0046: `?range=` is resolved in the project's reporting zone, so the dashboard can ask for
// the Overview before it has loaded the project.
let t: Awaited<ReturnType<typeof startTestApp>>;
let tenants: Awaited<ReturnType<typeof seedTwoTenants>>;
let path: string;
const ZONE = "Asia/Tehran";

beforeEach(async () => {
  await resetDb();
  t = await startTestApp();
  tenants = await seedTwoTenants(t.sql);
  const projectId = tenants.ids.projectA;
  await t.sql`UPDATE projects SET reporting_timezone = ${ZONE} WHERE id = ${projectId}`;
  const [env] = await t.sql<{ id: string }[]>`
    INSERT INTO environments (project_id, name) VALUES (${projectId}, 'production') RETURNING id`;
  const at = new Date(Date.now() - 60_000).toISOString();
  await seedVisit(
    t.sql,
    { projectId, environmentId: env?.id ?? "" },
    { visitor: 1, at, pages: ["/"] },
  );
  path = `/projects/${projectId}/stats`;
});
afterEach(() => t.close());

it("resolves `range` to whole days in the project's zone on every stats route", async () => {
  const { viewerA } = tenants.cookies;
  const expected = presetRange("7d", ZONE);
  const overview = await call(t, "GET", `${path}/overview?range=7d`, viewerA);
  expect(overview.statusCode).toBe(200);
  expect(overview.json().meta).toMatchObject({
    from: expected.from.toISOString(),
    to: expected.to.toISOString(),
    timezone: ZONE,
  });
  expect(overview.json().metrics.visits.value).toBe(1);
  const sources = await call(t, "GET", `${path}/sources?range=today&by=channel`, viewerA);
  expect(sources.json().meta.from).toBe(presetRange("today", ZONE).from.toISOString());
  const pages = await call(t, "GET", `${path}/pages?range=30d`, viewerA);
  expect(pages.statusCode).toBe(200);
  const csv = await call(t, "GET", `${path}/export.csv?report=pages&range=30d`, viewerA);
  expect(csv.statusCode).toBe(200);
});

it("refuses an unknown preset or `range` with from/to; hides other tenants' projects", async () => {
  const { viewerA, ownerB } = tenants.cookies;
  const bad = await call(t, "GET", `${path}/overview?range=365d`, viewerA);
  expect(bad.json().error.code).toBe("VALIDATION_FAILED");
  const both = `${path}/overview?range=7d&from=2026-10-05T00:00:00Z&to=2026-10-12T00:00:00Z`;
  expect((await call(t, "GET", both, viewerA)).statusCode).toBe(400);
  expect((await call(t, "GET", `${path}/overview?range=7d`, ownerB)).statusCode).toBe(404);
});

it("share view resolves `range` in the shared project's zone", async () => {
  const shares = `/projects/${tenants.ids.projectA}/shares`;
  const { token } = (await call(t, "POST", shares, tenants.cookies.ownerA, { label: "B" })).json();
  const headers = { "x-share-token": token };
  const url = "/api/v1/share/stats/overview?range=today";
  const res = await t.send({ method: "GET", url, headers });
  expect(res.json().meta.from).toBe(presetRange("today", ZONE).from.toISOString());
  const bad = await t.send({ method: "GET", url: `${url}&from=2026-10-05T00:00:00Z`, headers });
  expect(bad.statusCode).toBe(400);
});
