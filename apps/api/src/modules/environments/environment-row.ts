import type { Environment } from "@didban/contracts";
import { normalizeCidrs } from "../../domain/cidr.js";
import { AppError } from "../../http/app-error.js";

/** Columns behind the `Environment` contract; use as `SELECT ${sql(ENVIRONMENT_COLUMNS)}`. */
export const ENVIRONMENT_COLUMNS = [
  "id",
  "project_id",
  "name",
  "identity_mode",
  "allowed_origins",
  "excluded_cidrs",
  "track_localhost",
  "created_at",
] as const;

export type EnvironmentRow = Omit<Environment, "createdAt"> & { createdAt: Date };

export const toEnvironment = (row: EnvironmentRow): Environment => ({
  ...row,
  createdAt: row.createdAt.toISOString(),
});

/** CIDR syntax needs `node:net`, so it is checked here rather than in the shared Zod schema. */
export function checkedCidrs(values: string[] | undefined): string[] | undefined {
  if (values === undefined) return undefined;
  const cidrs = normalizeCidrs(values);
  if (!cidrs) throw new AppError(400, "VALIDATION_FAILED", "Invalid request body");
  return cidrs;
}
