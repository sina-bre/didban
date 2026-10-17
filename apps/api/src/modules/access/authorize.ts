import type { FastifyRequest } from "fastify";
import type { Sql } from "../../db/db.module.js";
import { type AccessScope, decide, type Permission } from "../../domain/permissions.js";
import { AppError, notFound } from "../../http/app-error.js";
import { loadAccessScope, type ScopeSubject } from "./load-access-scope.js";

declare module "fastify" {
  interface FastifyRequest {
    scope?: AccessScope;
  }
}

type RouteParams = { organizationId?: unknown; projectId?: unknown };
const asId = (value: unknown) => (typeof value === "string" ? value : undefined);

/**
 * Loads the AccessScope and applies the route's permission (spec §11). Throws 404 for targets
 * the principal cannot see (same body as a missing resource), 403 for visible-but-not-allowed.
 * A route without a declared permission is a programming error: fail closed.
 */
export async function authorize(
  sql: Sql,
  request: FastifyRequest,
  subject: ScopeSubject,
  permission: Permission | undefined,
): Promise<void> {
  if (!permission) throw new Error(`route without @Requires: ${request.routeOptions.url}`);
  const scope = await loadAccessScope(sql, subject);
  const params = (request.params ?? {}) as RouteParams;
  const decision = decide(scope, permission, {
    organizationId: asId(params.organizationId),
    projectId: asId(params.projectId),
  });
  if (decision === "not_found") throw notFound();
  if (decision === "forbidden") throw new AppError(403, "FORBIDDEN", "Not allowed");
  request.scope = scope;
}
