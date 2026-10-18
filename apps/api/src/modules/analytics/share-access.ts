import { SHARE_TOKEN_PATTERN } from "@didban/contracts";
import type { Sql } from "../../db/db.module.js";
import type { AccessScope } from "../../domain/permissions.js";
import { notFound } from "../../http/app-error.js";
import { hashShareToken } from "../shares/share-link-row.js";

// A share token opens one project read-only (spec §11). Unknown, revoked or expired tokens, and
// archived projects or suspended organizations, all look like a missing resource (404).

export type SharedProject = {
  projectId: string;
  organizationId: string;
  projectName: string;
  label: string;
  timezone: string;
};

export async function resolveShare(sql: Sql, token: string | undefined): Promise<SharedProject> {
  if (!token || !SHARE_TOKEN_PATTERN.test(token)) throw notFound();
  const [row] = await sql<SharedProject[]>`
    SELECT p.id AS project_id, p.organization_id, p.name AS project_name, s.label,
           p.reporting_timezone AS timezone
    FROM share_links s
    JOIN projects p ON p.id = s.project_id
    JOIN organizations o ON o.id = p.organization_id
    WHERE s.token_hash = ${hashShareToken(token)} AND s.revoked_at IS NULL
      AND (s.expires_at IS NULL OR s.expires_at > now())
      AND p.archived_at IS NULL AND o.suspended_at IS NULL`;
  if (!row) throw notFound();
  return row;
}

/** A viewer of exactly this project and nothing else; the stats use cases check it as usual. */
export function shareScope(shared: SharedProject): AccessScope {
  return {
    userId: "share-link",
    isPlatformAdmin: false,
    organizations: new Map(),
    projects: new Map([
      [
        shared.projectId,
        { organizationId: shared.organizationId, orgRole: "member", projectRole: "viewer" },
      ],
    ]),
  };
}
