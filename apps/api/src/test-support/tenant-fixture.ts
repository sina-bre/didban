import type { Sql } from "../db/db.module.js";
import * as seed from "./seed-org.js";
import { ORIGIN, type startTestApp } from "./test-app.js";

type TestApp = Awaited<ReturnType<typeof startTestApp>>;

/**
 * Spec §11 example with real IDs: Organization A owns `HeliumPark`, Organization B owns
 * `Another Website`. Every user gets a live session cookie.
 */
export async function seedTwoTenants(sql: Sql) {
  const orgA = await seed.seedOrg(sql, "heliumpark");
  const ownerA = await seed.seedMember(sql, orgA, "a@helium.test", "owner");
  const adminA = await seed.seedMember(sql, orgA, "admin@helium.test", "admin");
  const memberA = await seed.seedMember(sql, orgA, "m@helium.test", "member");
  const viewerA = await seed.seedMember(sql, orgA, "v@helium.test", "member");
  const projectA = await seed.seedProject(sql, orgA, "heliumpark");
  await seed.seedProjectMember(sql, projectA, orgA, viewerA, "viewer");
  const orgB = await seed.seedOrg(sql, "another-website");
  const ownerB = await seed.seedMember(sql, orgB, "b@another.test", "owner");
  const projectB = await seed.seedProject(sql, orgB, "another-website");
  const cookie = async (userId: string) => seed.seedSession(sql, userId);
  return {
    ids: { orgA, ownerA, adminA, memberA, viewerA, projectA, orgB, ownerB, projectB },
    cookies: {
      ownerA: await cookie(ownerA),
      adminA: await cookie(adminA),
      memberA: await cookie(memberA),
      viewerA: await cookie(viewerA),
      ownerB: await cookie(ownerB),
    },
  };
}

/** A request the way the dashboard sends it: same Origin, JSON body (also on DELETE). */
export function call(t: TestApp, method: string, url: string, cookie: string, body: unknown = {}) {
  const hasBody = method !== "GET";
  return t.send({
    method: method as "GET",
    url: `/api/v1${url}`,
    headers: {
      cookie,
      origin: ORIGIN,
      ...(hasBody ? { "content-type": "application/json" } : {}),
    },
    ...(hasBody ? { payload: JSON.stringify(body) } : {}),
  });
}

/** Just the status code of `call(...)`. */
export async function statusOf(...args: Parameters<typeof call>): Promise<number> {
  return (await call(...args)).statusCode;
}

/** The error body without the per-request ID, for "identical to a missing resource" checks. */
export const bodyWithoutRequestId = (json: { error: object }) => ({
  ...json.error,
  requestId: undefined,
});
