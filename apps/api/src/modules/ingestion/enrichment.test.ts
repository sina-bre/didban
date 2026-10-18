import { CHANNELS, DEVICE_TYPES } from "@didban/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { resetDb } from "../../test-support/reset-db.js";
import { BROWSER_UA, batchBody, SITE, seedIngestTarget } from "../../test-support/seed-ingest.js";
import { startTestApp } from "../../test-support/test-app.js";
import { EnrichBatch } from "./enrich/enrich-batch.js";
import { IngestDiagnostics } from "./ingest-diagnostics.js";
import { PrepareBatch } from "./prepare-batch.js";

// Spec §7 step 6 with settings from the database and the client IP from Fastify's trusted proxy.

let t: Awaited<ReturnType<typeof startTestApp>>;
afterEach(() => t.close());

async function setup(env: Record<string, string> = {}) {
  await resetDb();
  t = await startTestApp(env);
  return seedIngestTarget(t.sql);
}

function withEvent(writeKey: string, event: Record<string, unknown>) {
  const body = batchBody(writeKey);
  body.events = [{ ...body.events[0], ...event } as (typeof body.events)[number]];
  return body;
}

async function enrich(body: unknown, userAgent = BROWSER_UA) {
  const batch = await t.app.get(PrepareBatch).execute({ body, origin: SITE, ip: "198.51.100.1" });
  return t.app.get(EnrichBatch).execute(batch, { ip: "198.51.100.1", userAgent });
}

const codes = () =>
  t.app
    .get(IngestDiagnostics)
    .drain()
    .counters.map((row) => `${row.code}:${row.count}`);

describe("enrichment with database settings", () => {
  it("applies route templates, kept query values, UTM channel and the PII guard", async () => {
    const target = await setup();
    await t.sql`UPDATE projects SET url_param_allowlist = ${["plan"]} WHERE id = ${target.projectId}`;
    await t.sql`INSERT INTO route_templates (project_id, position, pattern) VALUES
      (${target.projectId}, 1, '/products/new'), (${target.projectId}, 2, '/products/:id')`;
    const { events, filtered } = await enrich(
      withEvent(target.browserKey, {
        url: `${SITE}/products/42/?utm_medium=cpc&utm_source=google&plan=pro&email=a@b.io`,
        referrer: "https://www.google.com/",
        properties: { contact: "jane@example.com", seats: 3 },
      }),
    );
    expect(filtered).toBe(0);
    expect(events[0]).toMatchObject({
      hostname: "heliumpark.example",
      pathname: "/products/42",
      route: "/products/:id",
      referrerHost: "google.com",
      referrerSource: "Google",
      channel: CHANNELS.paidSearch,
      utm: { source: "google", medium: "cpc", campaign: null },
      properties: { seats: 3, plan: "pro" },
      browser: "Chrome",
      deviceType: DEVICE_TYPES.desktop,
    });
    expect(codes()).toEqual(["PII_DROPPED:1"]);
  });

  it("drops bots and localhost silently and counts them", async () => {
    const target = await setup();
    expect((await enrich(batchBody(target.browserKey, [0, 1]), "Googlebot/2.1")).filtered).toBe(2);
    const local = withEvent(target.browserKey, { url: "http://localhost:3000/" });
    expect((await enrich(local)).events).toHaveLength(0);
    expect(codes().sort()).toEqual(["BOT_FILTERED:2", "LOCALHOST_EXCLUDED:1"]);
    await t.sql`UPDATE environments SET track_localhost = true WHERE id = ${target.environmentId}`;
    // Settings are cached with the key for 60 s, so a fresh process sees the change.
    await t.close();
    t = await startTestApp();
    expect((await enrich(local)).events).toHaveLength(1);
  });
});

describe("enrichment for server keys", () => {
  it("never takes visitor traits from server-key requests", async () => {
    const target = await setup();
    const body = withEvent(target.serverKey, { url: "http://localhost/x", userId: "u-1" });
    const { events } = await enrich(body, "Googlebot/2.1");
    expect(events[0]).toMatchObject({
      browser: null,
      deviceType: null,
      country: null,
      userId: "u-1",
    });
  });
});

describe("client IP behind a trusted proxy (spec §7 step 6)", () => {
  async function internalHits(xff: string) {
    await t.send({
      method: "POST",
      url: "/api/v1/ingest/batch",
      payload: JSON.stringify(batchBody(target.browserKey)),
      headers: {
        "content-type": "text/plain",
        origin: SITE,
        "user-agent": BROWSER_UA,
        "x-forwarded-for": xff,
      },
    });
    return codes().filter((code) => code.startsWith("INTERNAL_TRAFFIC"));
  }
  let target: Awaited<ReturnType<typeof setup>>;

  it("uses the hop next to the proxy, never a spoofed leftmost entry", async () => {
    target = await setup({ TRUST_PROXY: "1" });
    await t.sql`UPDATE environments SET excluded_cidrs = ${["203.0.113.7/32"]}
                WHERE id = ${target.environmentId}`;
    expect(await internalHits("203.0.113.7")).toEqual(["INTERNAL_TRAFFIC:1"]);
    expect(await internalHits("203.0.113.7, 198.51.100.1")).toEqual([]);
  });

  it("ignores X-Forwarded-For when no proxy is trusted", async () => {
    target = await setup({ TRUST_PROXY: "0" });
    await t.sql`UPDATE environments SET excluded_cidrs = ${["203.0.113.7/32"]}
                WHERE id = ${target.environmentId}`;
    expect(await internalHits("203.0.113.7")).toEqual([]);
  });
});
