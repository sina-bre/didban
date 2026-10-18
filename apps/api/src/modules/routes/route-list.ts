import type { RouteTemplate } from "@didban/contracts";
import { MAX_ROUTE_TEMPLATES } from "@didban/contracts";
import type postgres from "postgres";
import { parseRouteTemplate } from "../../domain/route-template.js";
import { AppError, notFound } from "../../http/app-error.js";

// The ordered template list of one project. Every change locks the project row, loads the list,
// edits it in memory and writes it back with positions 1..n. Positions are part of the primary
// key, so shifting them in place would collide; at ≤ 200 rows a rewrite is the simple path.

export type RouteRow = { id: string; pattern: string; createdAt: Date };

export const toRouteTemplate = (row: RouteRow, index: number): RouteTemplate => ({
  id: row.id,
  position: index + 1,
  pattern: row.pattern,
  createdAt: row.createdAt.toISOString(),
});

/** The patterns' syntax needs the server-side parser, so it is checked here (400 like Zod). */
export function checkedPattern(pattern: string): string {
  if (!parseRouteTemplate(pattern)) {
    throw new AppError(400, "VALIDATION_FAILED", "Invalid route template");
  }
  return pattern;
}

export async function lockRouteList(
  tx: postgres.TransactionSql,
  projectId: string,
): Promise<RouteRow[]> {
  const [project] = await tx`SELECT 1 FROM projects WHERE id = ${projectId} FOR NO KEY UPDATE`;
  if (!project) throw notFound();
  return tx<RouteRow[]>`
    SELECT id, pattern, created_at FROM route_templates
    WHERE project_id = ${projectId} ORDER BY position`;
}

/** 409 when another template already has this pattern. */
export function assertUniquePattern(rows: RouteRow[], pattern: string, exceptId?: string) {
  if (rows.some((row) => row.pattern === pattern && row.id !== exceptId)) {
    throw new AppError(409, "ROUTE_TEMPLATE_EXISTS", "A route template with this pattern exists");
  }
}

export function assertRoom(rows: RouteRow[]) {
  if (rows.length >= MAX_ROUTE_TEMPLATES) {
    throw new AppError(409, "ROUTE_TEMPLATE_LIMIT", "A project has at most 200 route templates");
  }
}

/** Puts `row` at a 1-based position (clamped to the list), returning a new list. */
export function placeAt(rows: RouteRow[], row: RouteRow, position: number | undefined): RouteRow[] {
  const index = Math.min((position ?? rows.length + 1) - 1, rows.length);
  return [...rows.slice(0, index), row, ...rows.slice(index)];
}

export async function writeRouteList(
  tx: postgres.TransactionSql,
  projectId: string,
  rows: RouteRow[],
): Promise<void> {
  await tx`DELETE FROM route_templates WHERE project_id = ${projectId}`;
  if (rows.length === 0) return;
  const values = rows.map((row, i) => ({ ...row, projectId, position: i + 1 }));
  await tx`INSERT INTO route_templates ${tx(values, "id", "projectId", "position", "pattern", "createdAt")}`;
}
