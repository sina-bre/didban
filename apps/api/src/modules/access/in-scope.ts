import type { AccessScope } from "../../domain/permissions.js";
import { notFound } from "../../http/app-error.js";

// Second gate after the guard (ADR 0019): tenant use cases take the AccessScope and read IDs
// through these, so a use case called from a new route without `@Requires` still cannot leak.

export function projectInScope(scope: AccessScope, projectId: string): string {
  if (!scope.projects.has(projectId)) throw notFound();
  return projectId;
}

export function organizationInScope(scope: AccessScope, organizationId: string): string {
  if (!scope.organizations.has(organizationId)) throw notFound();
  return organizationId;
}
