import type { OrganizationListResponse } from "@didban/contracts";
import type { Sql } from "../../db/db.module.js";
import type { AccessScope } from "../../domain/permissions.js";

/** The caller's organizations (the org switcher). Suspended ones are already out of the scope. */
export async function listOrganizations(
  sql: Sql,
  scope: AccessScope,
): Promise<OrganizationListResponse> {
  const ids = [...scope.organizations.keys()];
  if (ids.length === 0) return { organizations: [] };
  const rows = await sql<{ id: string; name: string; slug: string }[]>`
    SELECT id, name, slug FROM organizations WHERE id IN ${sql(ids)} ORDER BY name, id`;
  return {
    organizations: rows.map((row) => ({
      ...row,
      role: scope.organizations.get(row.id) ?? "member",
    })),
  };
}
