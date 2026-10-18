import type {
  RoutePreviewRequest,
  RoutePreviewResponse,
  RouteTemplateListResponse,
} from "@didban/contracts";
import type { Sql } from "../../db/db.module.js";
import type { AccessScope } from "../../domain/permissions.js";
import { findRoute, parseRouteTemplate } from "../../domain/route-template.js";
import { projectInScope } from "../access/in-scope.js";
import { checkedPattern, type RouteRow, toRouteTemplate } from "./route-list.js";

// Reads (`project:manage`, spec §10: route templates are a project-admin setting).

async function savedRows(sql: Sql, projectId: string): Promise<RouteRow[]> {
  return sql<RouteRow[]>`
    SELECT id, pattern, created_at FROM route_templates
    WHERE project_id = ${projectId} ORDER BY position`;
}

export async function listRouteTemplates(
  sql: Sql,
  scope: AccessScope,
  projectId: string,
): Promise<RouteTemplateListResponse> {
  const rows = await savedRows(sql, projectInScope(scope, projectId));
  return { routes: rows.map(toRouteTemplate) };
}

/** Same matcher as ingestion. Candidate `patterns` are checked like saved ones. */
export async function previewRoutes(
  sql: Sql,
  scope: AccessScope,
  input: RoutePreviewRequest & { projectId: string },
): Promise<RoutePreviewResponse> {
  const projectId = projectInScope(scope, input.projectId);
  const patterns =
    input.patterns?.map(checkedPattern) ??
    (await savedRows(sql, projectId)).map((row) => row.pattern);
  const templates = patterns.flatMap((pattern) => parseRouteTemplate(pattern) ?? []);
  return { results: input.paths.map((path) => ({ path, template: findRoute(templates, path) })) };
}
