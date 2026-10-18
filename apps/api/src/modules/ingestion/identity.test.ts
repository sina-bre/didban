import { afterEach, describe, expect, it } from "vitest";
import { page, sendEvents, track } from "../../test-support/ingest-events.js";
import { resetDb } from "../../test-support/reset-db.js";
import { BROWSER_UA, seedIngestTarget } from "../../test-support/seed-ingest.js";
import { startTestApp } from "../../test-support/test-app.js";

// Spec §4 identity modes + §6.2 server-key rules + §7 step 7, over HTTP on the test DB.

let t: Awaited<ReturnType<typeof startTestApp>>;
afterEach(() => t.close());

async function setup() {
  await resetDb();
  t = await startTestApp();
  return seedIngestTarget(t.sql);
}

const visitors = async () =>
  (await t.sql<{ n: number }[]>`SELECT count(DISTINCT visitor_id)::int AS n FROM events`)[0]?.n;
const FIREFOX = "Mozilla/5.0 (X11; Linux x86_64; rv:142.0) Gecko/20100101 Firefox/142.0";

describe("cookieless identity", () => {
  it("hashes IP + UA with today's salt; nothing raw is stored", async () => {
    const target = await setup();
    await t.sql`INSERT INTO daily_salts (day, salt) VALUES (current_date - 3, ${Buffer.alloc(32)})`;
    await sendEvents(t, target.browserKey, [page("/a")]);
    await sendEvents(t, target.browserKey, [page("/b")]);
    await sendEvents(t, target.browserKey, [page("/c")], { userAgent: FIREFOX });
    await sendEvents(t, target.browserKey, [page("/d")], { ip: "203.0.113.9" });
    expect(await visitors()).toBe(3);
    const salts = await t.sql`SELECT day FROM daily_salts`;
    expect(salts).toHaveLength(1); // the 3-day-old salt is gone
    const [row] = await t.sql`SELECT * FROM events LIMIT 1`;
    const stored = JSON.stringify(row);
    expect(stored).not.toContain("198.51.100.7");
    expect(stored).not.toContain(BROWSER_UA);
  });

  it("never shares visitor IDs between projects", async () => {
    const a = await setup();
    const b = await seedIngestTarget(t.sql, "otherpark");
    await sendEvents(t, a.browserKey, [page("/a")]);
    await sendEvents(t, b.browserKey, [page("/a")]);
    expect(await visitors()).toBe(2);
  });
});

describe("persistent identity and visitor limits", () => {
  it("uses anonymousId in persistent mode and caps distinct visitors per browser batch", async () => {
    const target = await setup();
    await t.sql`UPDATE environments SET identity_mode = 'persistent'`;
    const ids = (n: number) =>
      Array.from({ length: n }, (_, i) => page("/", 0, { anonymousId: `anon-${i}` }));
    const ok = await sendEvents(t, target.browserKey, ids(5));
    expect(ok.json()).toMatchObject({ accepted: 5 });
    expect(await visitors()).toBe(5);
    const tooMany = await sendEvents(t, target.browserKey, ids(6));
    expect(tooMany.statusCode).toBe(400);
    expect(tooMany.json().error.code).toBe("TOO_MANY_VISITORS_IN_BATCH");
  });

  it("falls back to the cookieless hash when anonymousId is missing (no consent yet)", async () => {
    const target = await setup();
    await t.sql`UPDATE environments SET identity_mode = 'persistent'`;
    await sendEvents(t, target.browserKey, [page("/a"), page("/b", 0, { anonymousId: "anon-1" })]);
    expect(await visitors()).toBe(2);
  });
});

describe("server events and identify", () => {
  it("requires userId or anonymousId on server events; anonymousId joins the browser visitor", async () => {
    const target = await setup();
    await t.sql`UPDATE environments SET identity_mode = 'persistent'`;
    await sendEvents(t, target.browserKey, [page("/", 0, { anonymousId: "anon-7" })]);
    const res = await sendEvents(
      t,
      target.serverKey,
      [
        track("paid"),
        track("paid", 0, { anonymousId: "anon-7" }),
        track("paid", 0, { userId: "u-1" }),
      ],
      { server: true },
    );
    expect(res.json()).toMatchObject({
      accepted: 2,
      rejected: [{ index: 0, code: "INVALID_EVENT", path: "userId" }],
    });
    expect(await visitors()).toBe(2); // anon-7 (browser + server) and u-1
    expect(await t.sql`SELECT 1 FROM visits`).toHaveLength(1);
  });

  it("stores user IDs only when allow_identify is on; identify events are dropped otherwise", async () => {
    const target = await setup();
    const identify = page("/", 0, { type: "identify", userId: "u-9" });
    const off = await sendEvents(t, target.browserKey, [
      identify,
      page("/x", 0, { userId: "u-9" }),
    ]);
    expect(off.json()).toMatchObject({ accepted: 2 });
    expect(await t.sql`SELECT type, user_id FROM events`).toEqual([{ type: 1, userId: null }]);
    await t.sql`UPDATE projects SET allow_identify = true`;
    await t.close();
    t = await startTestApp(); // settings are cached with the key for 60 s
    await sendEvents(t, target.browserKey, [page("/", 0, { type: "identify", userId: "u-9" })]);
    expect(await t.sql`SELECT user_id FROM events WHERE type = 3`).toEqual([{ userId: "u-9" }]);
  });
});
