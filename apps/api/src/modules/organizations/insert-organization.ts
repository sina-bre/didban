import type postgres from "postgres";
import { AppError } from "../../http/app-error.js";

export type NewOrganization = { organizationId: string; slug: string };

/** "Acme Analytics GmbH" → "acme-analytics-gmbh". Non-Latin names fall back to "org". */
export function slugify(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "") // drop accents split off by NFKD
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/, "");
  return slug || "org";
}

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
  const slug = await freeSlug(tx, slugify(name));
  const [org] = await tx<{ id: string }[]>`
    INSERT INTO organizations (name, slug) VALUES (${name}, ${slug}) RETURNING id`;
  if (!org) throw new Error("insert returned no row");
  return { organizationId: org.id, slug };
}

/** "acme", then "acme-2", "acme-3"... The unique constraint still guards against races. */
async function freeSlug(tx: postgres.TransactionSql, base: string): Promise<string> {
  const rows = await tx<{ slug: string }[]>`
    SELECT slug FROM organizations WHERE slug = ${base} OR slug LIKE ${`${base}-%`}`;
  const used = new Set(rows.map((row) => row.slug));
  let slug = base;
  for (let n = 2; used.has(slug); n += 1) slug = `${base}-${n}`;
  return slug;
}
