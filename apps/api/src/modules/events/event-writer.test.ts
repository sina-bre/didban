import postgres from "postgres";
import { afterEach, describe, expect, it } from "vitest";
import { page, sendEvents, track } from "../../test-support/ingest-events.js";
import { resetDb } from "../../test-support/reset-db.js";
import { seedIngestTarget } from "../../test-support/seed-ingest.js";
import { startTestApp } from "../../test-support/test-app.js";
import { requireVar } from "../../test-support/test-env.js";
import { PAGES_SEEN_CAP } from "./upsert-pages-seen.js";

// Spec §7 step 8 + §16: bulk insert, dedupe on retry, visit assignment, concurrency, chunking,
// pages_seen cap, usage, and rollback on a mid-batch failure. Real PostgreSQL, over HTTP.

let t: Awaited<ReturnType<typeof startTestApp>>;
afterEach(() => t.close());

async function setup(env: Record<string, string> = {}) {
  await resetDb();
  t = await startTestApp(env);
  return seedIngestTarget(t.sql);
}

const count = async (table: "events" | "visits" | "pages_seen") =>
  (await t.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM ${t.sql(table)}`)[0]?.n;
const usage = async () =>
  (await t.sql<{ events: string }[]>`SELECT events FROM project_usage_daily`)[0]?.events;

/** Holds a visitor lock from another connection until every started request blocks on it. */
async function whileLocked(lockKey: string, start: () => PromiseLike<{ statusCode: number }>[]) {
  const holder = postgres(requireVar("TEST_DATABASE_URL"), { max: 1, onnotice: () => {} });
  try {
    const { pending } = await holder.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
      const waiting = async () =>
        (
          await tx<{ n: number }[]>`SELECT count(*)::int AS n FROM pg_locks
            WHERE locktype = 'advisory' AND NOT granted`
        )[0]?.n ?? 0;
      // inject() is lazy until then(): Promise.resolve starts the requests now.
      const pending = start().map((request) => Promise.resolve(request));
      for (let i = 0; i < 100 && (await waiting()) < pending.length; i++)
        await new Promise((r) => setTimeout(r, 20));
      expect(await waiting()).toBe(pending.length); // every request blocks on the lock
      return { pending }; // an array would be awaited inside the transaction
    });
    return await Promise.all(pending);
  } finally {
    await holder.end();
  }
}

describe("event writer: storage and visits", () => {
  it("commits events, one visit, discovered pages and usage before answering 200", async () => {
    const target = await setup();
    const events = [
      page("/pricing", 60_000, { title: "Pricing" }),
      track("signup", 30_000),
      page("/done"),
    ];
    const res = await sendEvents(t, target.browserKey, events);
    expect(res.json()).toMatchObject({ accepted: 3, duplicates: 0, rejected: [] });
    const rows =
      await t.sql`SELECT source, visit_id, browser, route FROM events ORDER BY occurred_at`;
    expect(rows.map((r) => r.source)).toEqual([1, 1, 1]);
    expect(new Set(rows.map((r) => r.visitId)).size).toBe(1);
    expect(rows[0]).toMatchObject({ browser: "Chrome", route: "/pricing" });
    const [visit] = await t.sql`SELECT * FROM visits`;
    expect(visit).toMatchObject({
      pageviews: 2,
      events: 3,
      entryPathname: "/pricing",
      exitPathname: "/done",
    });
    const pages = await t.sql`SELECT route, last_title FROM pages_seen ORDER BY route`;
    expect(pages).toEqual([
      { route: "/done", lastTitle: null },
      { route: "/pricing", lastTitle: "Pricing" },
    ]);
    expect(await usage()).toBe("3");
  });
});

describe("event writer: retries and deduplication", () => {
  it("deduplicates a retried batch: nothing is counted twice", async () => {
    const target = await setup();
    const events = [page("/a", 5_000), page("/b")];
    await sendEvents(t, target.browserKey, events);
    const retry = await sendEvents(t, target.browserKey, events, {
      sentAt: new Date(Date.now() + 2_000).toISOString(),
    });
    expect(retry.statusCode).toBe(200);
    expect(retry.json()).toMatchObject({ accepted: 0, duplicates: 2 });
    expect(await count("events")).toBe(2);
    const [visit] = await t.sql`SELECT pageviews, events FROM visits`;
    expect(visit).toEqual({ pageviews: 2, events: 2 });
    expect(await usage()).toBe("2");
  });

  it("dedupes a ULID event ID like the UUID it encodes, also inside one batch", async () => {
    const target = await setup();
    const ulid = page("/u", 0, { eventId: "01JABCDEFGHJKMNPQRSTVWXYZ0" });
    const res = await sendEvents(t, target.browserKey, [ulid, ulid]);
    expect(res.json()).toMatchObject({ accepted: 1, duplicates: 1 });
  });
});

describe("event writer: visit resolution", () => {
  it("starts a new visit after the session timeout and joins a late event to its visit", async () => {
    const target = await setup();
    await t.sql`UPDATE projects SET session_timeout_minutes = 5`;
    await sendEvents(t, target.browserKey, [page("/old", 20 * 60_000), page("/new", 60_000)]);
    expect(await count("visits")).toBe(2);
    await sendEvents(t, target.browserKey, [page("/late", 19 * 60_000)]);
    const visits = await t.sql`SELECT pageviews, exit_pathname FROM visits ORDER BY started_at`;
    expect(visits).toEqual([
      { pageviews: 2, exitPathname: "/late" },
      { pageviews: 1, exitPathname: "/new" },
    ]);
  });

  it("gives concurrent batches of one visitor a single visit (advisory lock)", async () => {
    const target = await setup({ DB_POOL_MAX: "4" });
    await sendEvents(t, target.browserKey, [page("/earlier", 2 * 3_600_000)]); // visit 1
    const [row] = await t.sql<
      { hex: string }[]
    >`SELECT encode(visitor_id, 'hex') AS hex FROM events`;
    const lockKey = `${target.projectId}${row?.hex}`;
    const results = await whileLocked(lockKey, () =>
      [0, 1].map((i) => sendEvents(t, target.browserKey, [page(`/p${i}`)])),
    );
    expect(results.map((r) => r.statusCode)).toEqual([200, 200]);
    const visits = await t.sql`SELECT pageviews FROM visits ORDER BY started_at`;
    expect(visits).toEqual([{ pageviews: 1 }, { pageviews: 2 }]);
  });

  it("chunks the insert at INGEST_INSERT_CHUNK rows", async () => {
    const target = await setup({ INGEST_INSERT_CHUNK: "2" });
    const events = Array.from({ length: 5 }, (_, i) => page(`/c${i}`, i * 1000));
    const res = await sendEvents(t, target.browserKey, events);
    expect(res.json()).toMatchObject({ accepted: 5, duplicates: 0 });
    expect(await count("events")).toBe(5);
  });
});

describe("event writer: server events, caps and rollback", () => {
  it("stores server events with source 2, no visit, no device and no discovered page", async () => {
    const target = await setup();
    const res = await sendEvents(t, target.serverKey, [track("paid", 0, { userId: "u-1" })], {
      server: true,
    });
    expect(res.json()).toMatchObject({ accepted: 1 });
    const [row] = await t.sql`SELECT source, visit_id, browser, country, user_id FROM events`;
    expect(row).toEqual({ source: 2, visitId: null, browser: null, country: null, userId: null });
    expect(await count("visits")).toBe(0);
    expect(await count("pages_seen")).toBe(0);
    expect(await usage()).toBe("1");
  });

  it("folds new routes past the per-project cap into /__other__", async () => {
    const target = await setup();
    await t.sql`INSERT INTO pages_seen (project_id, environment_id, hostname, route, first_seen_at, last_seen_at)
      SELECT ${target.projectId}, ${target.environmentId}, 'heliumpark.example', '/seed/' || n, now(), now()
      FROM generate_series(1, ${PAGES_SEEN_CAP - 1}) n`;
    await sendEvents(t, target.browserKey, [
      page("/seed/1"),
      page("/fits"),
      page("/over-1"),
      page("/over-2"),
    ]);
    const routes =
      await t.sql`SELECT route FROM pages_seen WHERE route NOT LIKE '/seed/%' ORDER BY route`;
    expect(routes.map((r) => r.route).sort()).toEqual(["/__other__", "/fits"].sort());
    expect(await count("events")).toBe(4);
  });

  it("rolls back the whole batch when a write fails midway", async () => {
    const target = await setup();
    const admin = postgres(requireVar("TEST_MIGRATION_DATABASE_URL"), {
      max: 1,
      onnotice: () => {},
    });
    await admin`CREATE FUNCTION fail_visit() RETURNS trigger LANGUAGE plpgsql AS
      $$ BEGIN RAISE EXCEPTION 'injected failure'; END $$`;
    await admin`CREATE TRIGGER fail_visit BEFORE INSERT ON visits FOR EACH ROW EXECUTE FUNCTION fail_visit()`;
    try {
      const res = await sendEvents(t, target.browserKey, [page("/x"), page("/y")]);
      expect(res.statusCode).toBe(500);
      expect(res.json().error.code).toBe("INTERNAL_ERROR");
      expect(await count("events")).toBe(0);
      expect(await count("pages_seen")).toBe(0);
      expect(await usage()).toBeUndefined();
    } finally {
      await admin`DROP TRIGGER fail_visit ON visits`;
      await admin`DROP FUNCTION fail_visit()`;
      await admin.end();
    }
  });
});
