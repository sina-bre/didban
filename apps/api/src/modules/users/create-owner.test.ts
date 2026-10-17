import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createSql } from "../../db/db.module.js";
import { slugify } from "../../domain/slug.js";
import { AppError } from "../../http/app-error.js";
import { resetDb } from "../../test-support/reset-db.js";
import { testEnv } from "../../test-support/test-env.js";
import { CreateOwnerError, createOwner } from "./create-owner.js";

const sql = createSql(testEnv());
afterAll(() => sql.end());
beforeEach(() => resetDb());

const PASSWORD = "correct horse battery";

describe("createOwner (spec §11: first owner via CLI)", () => {
  it("creates the user, the organization and an owner membership in one go", async () => {
    const result = await createOwner(sql, {
      email: " Owner@HeliumPark.TEST ",
      password: PASSWORD,
      organizationName: "HeliumPark",
    });
    expect(result.slug).toBe("heliumpark");
    const [row] = await sql`
      SELECT u.email, m.role, o.name, u.password_hash
      FROM memberships m JOIN users u ON u.id = m.user_id JOIN organizations o ON o.id = m.organization_id`;
    expect(row).toMatchObject({
      email: "owner@heliumpark.test",
      role: "owner",
      name: "HeliumPark",
    });
    expect(row?.passwordHash).toMatch(/^\$argon2id\$/);
  });

  it("picks a free slug and refuses a duplicate email, leaving nothing behind", async () => {
    await createOwner(sql, { email: "a@x.test", password: PASSWORD, organizationName: "Acme" });
    const second = await createOwner(sql, {
      email: "b@x.test",
      password: PASSWORD,
      organizationName: "ACME",
    });
    expect(second.slug).toBe("acme-2");
    const dup = createOwner(sql, {
      email: "a@x.test",
      password: PASSWORD,
      organizationName: "New",
    });
    await expect(dup).rejects.toBeInstanceOf(CreateOwnerError);
    const [count] = await sql`SELECT count(*)::int AS n FROM organizations`;
    expect(count?.n).toBe(2);
  });

  it("applies the password policy and validates the email", async () => {
    const weak = createOwner(sql, { email: "c@x.test", password: "short", organizationName: "C" });
    await expect(weak).rejects.toThrow(/TOO_SHORT/);
    const bad = createOwner(sql, { email: "nope", password: PASSWORD, organizationName: "C" });
    await expect(bad).rejects.toBeInstanceOf(CreateOwnerError);
    const noName = createOwner(sql, {
      email: "c@x.test",
      password: PASSWORD,
      organizationName: " ",
    });
    await expect(noName).rejects.toBeInstanceOf(AppError);
  });

  it("slugifies Latin names and falls back for other scripts", () => {
    expect(slugify("Acme Analytics GmbH", "org")).toBe("acme-analytics-gmbh");
    expect(slugify("Café Déjà Vu", "org")).toBe("cafe-deja-vu");
    expect(slugify("دیدبان", "org")).toBe("org");
  });
});
