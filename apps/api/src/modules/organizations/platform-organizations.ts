import type { Sql } from "../../db/db.module.js";
import { AppError, notFound } from "../../http/app-error.js";
import { recordAudit } from "../audit/record-audit.js";
import { insertOrganization, type NewOrganization } from "./insert-organization.js";

// Spec §11: platform admins create and suspend organizations. They do not become members, so
// they still cannot read the organization's projects or analytics. The first owner joins through
// an invite (Stage 2d). AccessScope (2c) skips suspended organizations.

export type PlatformActor = { userId: string; isPlatformAdmin: boolean };

const notPlatformAdmin = () => new AppError(403, "FORBIDDEN", "Not allowed");

export async function createOrganization(
  sql: Sql,
  actor: PlatformActor,
  name: string,
): Promise<NewOrganization> {
  if (!actor.isPlatformAdmin) throw notPlatformAdmin();
  return sql.begin(async (tx) => {
    const created = await insertOrganization(tx, name);
    await recordAudit(tx, {
      action: "organization.created",
      actorUserId: actor.userId,
      organizationId: created.organizationId,
      target: { type: "organization", id: created.organizationId },
    });
    return created;
  });
}

export async function setOrganizationSuspended(
  sql: Sql,
  actor: PlatformActor,
  organizationId: string,
  suspended: boolean,
): Promise<void> {
  if (!actor.isPlatformAdmin) throw notPlatformAdmin();
  await sql.begin(async (tx) => {
    const rows = await tx`
      UPDATE organizations
      SET suspended_at = CASE WHEN ${suspended} THEN coalesce(suspended_at, now()) END
      WHERE id = ${organizationId}
      RETURNING id`;
    if (rows.length === 0) throw notFound();
    await recordAudit(tx, {
      action: suspended ? "organization.suspended" : "organization.unsuspended",
      actorUserId: actor.userId,
      organizationId,
      target: { type: "organization", id: organizationId },
    });
  });
}
