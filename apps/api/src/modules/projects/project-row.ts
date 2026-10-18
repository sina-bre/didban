import type { Project } from "@didban/contracts";

/** Columns behind the `Project` contract; use as `SELECT ${sql(PROJECT_COLUMNS)}`. */
export const PROJECT_COLUMNS = [
  "id",
  "organization_id",
  "name",
  "slug",
  "reporting_timezone",
  "session_timeout_minutes",
  "retention_days",
  "allow_identify",
  "pii_guard",
  "url_param_allowlist",
  "trailing_slash_policy",
  "hash_routing",
  "store_city",
  "site_search_params",
  "archived_at",
  "created_at",
] as const;

export type ProjectRow = Omit<Project, "archivedAt" | "createdAt"> & {
  archivedAt: Date | null;
  createdAt: Date;
};

export function toProject(row: ProjectRow): Project {
  return {
    ...row,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
