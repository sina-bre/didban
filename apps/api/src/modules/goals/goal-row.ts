import type { Goal } from "@didban/contracts";
import type { Sql } from "../../db/db.module.js";
import { parseRouteTemplate } from "../../domain/route-template.js";
import { AppError } from "../../http/app-error.js";

// Goal rows as stored (migration 0012) and as the API returns them.

export type GoalRow = {
  id: string;
  name: string;
  kind: "event" | "page";
  eventName: string | null;
  pathPattern: string | null;
  createdAt: Date;
};

export const toGoal = (row: GoalRow): Goal => ({ ...row, createdAt: row.createdAt.toISOString() });

/** Page goals use the route-template syntax; anything else is a 400 before it is stored. */
export function checkedPathPattern(pattern: string): string {
  if (!parseRouteTemplate(pattern)) {
    throw new AppError(400, "VALIDATION_FAILED", "Invalid path pattern");
  }
  return pattern;
}

export function goalRows(sql: Sql, projectId: string): Promise<GoalRow[]> {
  return sql<GoalRow[]>`
    SELECT id, name, kind, event_name, path_pattern, created_at FROM goals
    WHERE project_id = ${projectId} ORDER BY created_at, id`;
}

/** Unique (project, name) clash → 409 with the same code the other modules use. */
export function isNameTaken(error: unknown): boolean {
  return (error as { code?: string }).code === "23505";
}
