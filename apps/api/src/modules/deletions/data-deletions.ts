import {
  type CreateDataDeletionRequest,
  type DataDeletion,
  type DataDeletionListResponse,
  MAX_OPEN_DELETIONS,
} from "@didban/contracts";
import type { Sql } from "../../db/db.module.js";
import type { AccessScope } from "../../domain/permissions.js";
import { anonymousVisitorId } from "../../domain/visitor-id.js";
import { AppError } from "../../http/app-error.js";
import { projectInScope } from "../access/in-scope.js";
import { projectAudit, recordAudit } from "../audit/record-audit.js";
import { COLUMNS, type Row, toDeletion } from "./data-deletion-row.js";

// `project:manage` (spec §11). The request is queued here; the job runner does the deleting
// (ADR 0045). A visitor is stored as its 16-byte hash, the anonymous ID itself is never kept.

const LIST_LIMIT = 50;

export async function listDataDeletions(
  sql: Sql,
  scope: AccessScope,
  projectId: string,
): Promise<DataDeletionListResponse> {
  const rows = await sql<Row[]>`
    SELECT ${sql(COLUMNS)} FROM data_deletions WHERE project_id = ${projectInScope(scope, projectId)}
    ORDER BY created_at DESC, id LIMIT ${LIST_LIMIT}`;
  return { deletions: rows.map(toDeletion) };
}

export function createDataDeletion(
  sql: Sql,
  scope: AccessScope,
  input: { projectId: string; body: CreateDataDeletionRequest },
): Promise<DataDeletion> {
  const projectId = projectInScope(scope, input.projectId);
  const { body } = input;
  const values = {
    projectId,
    kind: body.kind,
    fromAt: body.kind === "range" ? new Date(body.from) : null,
    toAt: body.kind === "range" ? new Date(body.to) : null,
    visitorId: body.kind === "visitor" ? anonymousVisitorId(projectId, body.anonymousId) : null,
    userId: body.kind === "user" ? body.userId : null,
    requestedBy: scope.userId,
  };
  return sql.begin(async (tx) => {
    await tx`SELECT 1 FROM projects WHERE id = ${projectId} FOR UPDATE`;
    const [open] = await tx<{ n: number }[]>`
      SELECT count(*)::int AS n FROM data_deletions
      WHERE project_id = ${projectId} AND status IN ('pending', 'running')`;
    if ((open?.n ?? 0) >= MAX_OPEN_DELETIONS) {
      throw new AppError(409, "DELETION_LIMIT_REACHED", "Wait for open deletions to finish");
    }
    const [row] = await tx<
      Row[]
    >`INSERT INTO data_deletions ${tx(values)} RETURNING ${tx(COLUMNS)}`;
    if (!row) throw new Error("insert returned no row");
    await recordAudit(tx, {
      ...projectAudit(scope, projectId),
      action: "data_deletion.requested",
      target: { type: "data_deletion", id: row.id },
      details: { kind: body.kind },
    });
    return toDeletion(row);
  });
}
