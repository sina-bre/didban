import type postgres from "postgres";
import { nextFreeSlug, slugify } from "../../domain/slug.js";
import { AppError } from "../../http/app-error.js";

export type NewOrganization = { organizationId: string; slug: string };

/** Validates the name, picks a free slug and inserts. Shared by `create-owner` and platform admins. */
export async function insertOrganization(
  tx: postgres.TransactionSql,
  rawName: string,
): Promise<NewOrganization> {
  const name = rawName.trim();
  if (name.length < 1 || name.length > 100) {
    throw new AppError(
      400,
      "INVALID_ORGANIZATION_NAME",
      "Organization name must be 1-100 characters.",
    );
  }
  const slug = await freeSlug(tx, slugify(name, "org"));
  const [org] = await tx<{ id: string }[]>`
    INSERT INTO organizations (name, slug) VALUES (${name}, ${slug}) RETURNING id`;
  if (!org) throw new Error("insert returned no row");
  return { organizationId: org.id, slug };
}

/** The unique constraint still guards against races. */
async function freeSlug(tx: postgres.TransactionSql, base: string): Promise<string> {
  const rows = await tx<{ slug: string }[]>`
    SELECT slug FROM organizations WHERE slug = ${base} OR slug LIKE ${`${base}-%`}`;
  return nextFreeSlug(base, new Set(rows.map((row) => row.slug)));
}
