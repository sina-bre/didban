import { LIMITS } from "@didban/contracts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "../../test-support/reset-db.js";
import { batchBody, SITE, seedIngestTarget } from "../../test-support/seed-ingest.js";
import { startTestApp } from "../../test-support/test-app.js";

// Spec §7 steps 1–3 and §6.1 over HTTP: body limit, JSON, write key, origin, CORS.
let t: Awaited<ReturnType<typeof startTestApp>>;
let target: Awaited<ReturnType<typeof seedIngestTarget>>;

beforeEach(async () => {
  await resetDb();
  t = await startTestApp();
  target = await seedIngestTarget(t.sql);
});
afterEach(() => t.close());

type Options = { type?: string; origin?: string; headers?: Record<string, string> };

/** Sends the way the browser SDK does by default: text/plain, key in the body, site Origin. */
function ingest(
  payload: unknown,
  { type = "text/plain", origin = SITE, headers = {} }: Options = {},
) {
  return t.send({
    method: "POST",
    url: "/api/v1/ingest/batch",
    payload: typeof payload === "string" ? payload : JSON.stringify(payload),
    headers: { "content-type": type, ...(origin ? { origin } : {}), ...headers },
  });
}
const codeOf = async (res: Promise<{ json: () => { error: { code: string } } }>) =>
  (await res).json().error.code;

describe("ingestion: body (spec §7 step 1)", () => {
  it("runs a valid browser batch through every check and commits it", async () => {
    const res = await ingest(batchBody(target.browserKey));
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ accepted: 1, duplicates: 0, rejected: [] });
    expect(res.headers["access-control-allow-origin"]).toBe("*");
    expect(res.headers["x-request-id"]).toBeDefined();
  });

  it("rejects a body over the limit with 413 before parsing", async () => {
    const res = await ingest(`"${"x".repeat(LIMITS.maxBodyBytes)}"`);
    expect(res.statusCode).toBe(413);
    expect(res.json().error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("answers INVALID_JSON for text/plain and application/json", async () => {
    expect(await codeOf(ingest("{nope"))).toBe("INVALID_JSON");
    expect(await codeOf(ingest("{nope", { type: "application/json" }))).toBe("INVALID_JSON");
  });
});

describe("ingestion: write key (spec §7 step 2)", () => {
  it("rejects missing, malformed and unknown keys the same way", async () => {
    const unknown = `dpk_${"0".repeat(12)}_${"A".repeat(43)}`;
    for (const key of [undefined, "nope", unknown]) {
      const res = await ingest(batchBody(key));
      expect(res.statusCode).toBe(401);
      expect(res.json().error.code).toBe("INVALID_WRITE_KEY");
    }
  });

  it("tells revoked keys apart and hides keys of archived projects", async () => {
    await t.sql`UPDATE api_keys SET revoked_at = now() WHERE kind = 'write_browser'`;
    expect(await codeOf(ingest(batchBody(target.browserKey)))).toBe("WRITE_KEY_REVOKED");
    await t.sql`UPDATE projects SET archived_at = now()`;
    expect(await codeOf(ingest(batchBody(target.serverKey)))).toBe("INVALID_WRITE_KEY");
  });
});

describe("ingestion: origin and CORS (spec §7 step 3, §6.1)", () => {
  it("checks Origin for browser keys only; server keys may use X-Write-Key", async () => {
    expect(
      await codeOf(ingest(batchBody(target.browserKey), { origin: "https://evil.example" })),
    ).toBe("ORIGIN_NOT_ALLOWED");
    expect(await codeOf(ingest(batchBody(target.browserKey), { origin: "" }))).toBe(
      "ORIGIN_NOT_ALLOWED",
    );
    const server = await ingest(batchBody(undefined), {
      type: "application/json",
      origin: "",
      headers: { "x-write-key": target.serverKey },
    });
    expect(server.statusCode).toBe(200);
  });

  it("answers preflights with a cacheable CORS response", async () => {
    const res = await t.send({
      method: "OPTIONS",
      url: "/api/v1/ingest/batch",
      headers: { origin: SITE, "access-control-request-method": "POST" },
    });
    expect(res.statusCode).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe("*");
    expect(res.headers["access-control-allow-headers"]).toContain("x-write-key");
    expect(res.headers["access-control-max-age"]).toBe("86400");
  });

  it("never runs the dashboard CSRF rule on ingestion", async () => {
    const res = await ingest(batchBody(target.serverKey), { origin: "https://other.example" });
    expect(res.statusCode).toBe(200);
  });
});
