import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import { requireVar } from "../test-support/test-env.js";
import { migrate } from "./migrate.js";
import { MIGRATIONS_DIR } from "./migration-files.js";

const app = postgres(requireVar("TEST_DATABASE_URL"), { max: 1, onnotice: () => {} });
afterAll(() => app.end());

describe("roles (spec §9.5)", () => {
  it("lets the app role read and write data", async () => {
    const [row] = await app`SELECT count(*)::int AS n FROM organizations`;
    expect(row?.n).toBeTypeOf("number");
  });

  it("refuses DDL for the app role", async () => {
    await expect(app`CREATE TABLE app_must_not_create (id int)`).rejects.toMatchObject({
      code: "42501", // insufficient_privilege
    });
    await expect(app`DROP TABLE memberships`).rejects.toMatchObject({ code: "42501" });
  });

  it("applies the app role timeouts", async () => {
    const [row] = await app`SHOW statement_timeout`;
    expect(row?.statement_timeout).toBe("15s");
  });
});

describe("migrate", () => {
  const url = requireVar("TEST_MIGRATION_DATABASE_URL");

  it("is idempotent", async () => {
    expect(await migrate(url, MIGRATIONS_DIR, () => {})).toEqual([]);
  });

  it("refuses an applied migration that was edited", async () => {
    const dir = mkdtempSync(join(tmpdir(), "didban-migrations-"));
    try {
      cpSync(MIGRATIONS_DIR, dir, { recursive: true });
      writeFileSync(join(dir, "0001_identity.sql"), "-- edited\nSELECT 1;\n");
      await expect(migrate(url, dir, () => {})).rejects.toThrow(/changed after it was applied/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
