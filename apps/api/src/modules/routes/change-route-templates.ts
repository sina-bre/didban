import { randomUUID } from "node:crypto";
import type {
  AuditAction,
  CreateRouteTemplateRequest,
  RouteTemplate,
  UpdateRouteTemplateRequest,
} from "@didban/contracts";
import type { Sql } from "../../db/db.module.js";
import type { AccessScope } from "../../domain/permissions.js";
import { notFound } from "../../http/app-error.js";
import { projectInScope } from "../access/in-scope.js";
import { changedFields, projectAudit, recordAudit } from "../audit/record-audit.js";
import * as list from "./route-list.js";

// `project:manage`. The audit row keeps field names only, never the typed pattern (ADR 0022).
// Ingestion picks changes up when its 60 s settings cache expires (ADR 0026).

type Edit = { projectId: string; routeId: string };
type Change = (rows: list.RouteRow[]) => { rows: list.RouteRow[]; target: list.RouteRow };

async function change(
  sql: Sql,
  scope: AccessScope,
  input: { projectId: string; action: AuditAction; fields?: string[] },
  apply: Change,
): Promise<RouteTemplate> {
  const projectId = projectInScope(scope, input.projectId);
  return sql.begin(async (tx) => {
    const { rows, target } = apply(await list.lockRouteList(tx, projectId));
    await list.writeRouteList(tx, projectId, rows);
    await recordAudit(tx, {
      ...projectAudit(scope, projectId),
      action: input.action,
      target: { type: "route_template", id: target.id },
      ...(input.fields ? { details: { fields: input.fields } } : {}),
    });
    return list.toRouteTemplate(target, Math.max(rows.indexOf(target), 0));
  });
}

export function createRouteTemplate(
  sql: Sql,
  scope: AccessScope,
  input: CreateRouteTemplateRequest & { projectId: string },
): Promise<RouteTemplate> {
  const pattern = list.checkedPattern(input.pattern);
  const action = "route_template.created";
  return change(sql, scope, { projectId: input.projectId, action }, (rows) => {
    list.assertRoom(rows);
    list.assertUniquePattern(rows, pattern);
    const target = { id: randomUUID(), pattern, createdAt: new Date() };
    return { rows: list.placeAt(rows, target, input.position), target };
  });
}

export function updateRouteTemplate(
  sql: Sql,
  scope: AccessScope,
  input: Edit & { changes: UpdateRouteTemplateRequest },
): Promise<RouteTemplate> {
  const { pattern, position } = input.changes;
  if (pattern !== undefined) list.checkedPattern(pattern);
  const meta = { ...input, action: "route_template.updated" as const };
  return change(sql, scope, { ...meta, fields: changedFields(input.changes) }, (rows) => {
    const current = rows.find((row) => row.id === input.routeId);
    if (!current) throw notFound();
    if (pattern !== undefined) list.assertUniquePattern(rows, pattern, current.id);
    const target = { ...current, pattern: pattern ?? current.pattern };
    const others = rows.filter((row) => row !== current);
    return { rows: list.placeAt(others, target, position ?? rows.indexOf(current) + 1), target };
  });
}

export async function deleteRouteTemplate(sql: Sql, scope: AccessScope, input: Edit) {
  const action = "route_template.deleted";
  await change(sql, scope, { projectId: input.projectId, action }, (rows) => {
    const target = rows.find((row) => row.id === input.routeId);
    if (!target) throw notFound();
    return { rows: rows.filter((row) => row !== target), target };
  });
}
