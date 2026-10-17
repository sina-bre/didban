import postgres from "postgres";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "../../test-support/reset-db.js";
import { startTestApp } from "../../test-support/test-app.js";
import { requireVar } from "../../test-support/test-env.js";
import { createOwner } from "../users/create-owner.js";
import { recordAudit } from "./record-audit.js";

let t: Awaited<ReturnType<typeof startTestApp>>;

beforeEach(async () => {
  await resetDb();
  t = await startTestApp();
});
afterEach(() => t.close());

describe("audit log is append-only (spec §11)", () => {
  it("the app role cannot update, delete or truncate", async () => {
    await recordAudit(t.sql, { action: "auth.logout", actorUserId: null });
    for (const statement of [
      t.sql`UPDATE audit_logs SET action = 'auth.login_succeeded'`,
      t.sql`DELETE FROM audit_logs`,
      t.sql`TRUNCATE audit_logs`,
    ]) {
      await expect(statement).rejects.toMatchObject({ code: "42501" });
    }
  });

  it("the trigger refuses changes even from the table owner", async () => {
    await recordAudit(t.sql, { action: "auth.logout", actorUserId: null });
    const owner = postgres(requireVar("TEST_MIGRATION_DATABASE_URL"), {
      max: 1,
      onnotice: () => {},
    });
    try {
      await expect(owner`DELETE FROM audit_logs`).rejects.toThrow(/append-only/);
      await expect(owner`UPDATE audit_logs SET details = '{}'`).rejects.toThrow(/append-only/);
    } finally {
      await owner.end();
    }
  });
});

describe("audit log holds no secrets (spec §11)", () => {
  const email = "owner@heliumpark.test";
  const password = "correct horse battery";

  it("logins are recorded without passwords or typed emails", async () => {
    await createOwner(t.sql, { email, password, organizationName: "HeliumPark" });
    await t.post("/auth/login", { email, password: "wrong but long enough" });
    await t.post("/auth/login", { email: "typo-pasted-secret@x.test", password });
    await t.post("/auth/login", { email, password });
    const rows = await t.sql<{ action: string; json: string }[]>`
      SELECT action, row_to_json(a)::text AS json FROM audit_logs a
      WHERE action LIKE 'auth.%' ORDER BY id`;
    expect(rows.map((r) => r.action)).toEqual([
      "auth.login_failed",
      "auth.login_failed",
      "auth.login_succeeded",
    ]);
    const all = rows.map((r) => r.json).join("\n");
    for (const secret of [password, "wrong but long enough", "typo-pasted-secret", email]) {
      expect(all).not.toContain(secret);
    }
  });

  it("CLI actions have no request context and no actor", async () => {
    await createOwner(t.sql, { email, password, organizationName: "HeliumPark" });
    const [row] = await t.sql`SELECT actor_user_id, request_id, ip_prefix FROM audit_logs`;
    expect(row).toEqual({ actorUserId: null, requestId: null, ipPrefix: null });
  });
});
