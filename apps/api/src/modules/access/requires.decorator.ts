import { SetMetadata } from "@nestjs/common";
import type { Permission } from "../../domain/permissions.js";

export const REQUIRED_PERMISSION = "didban:permission";

/**
 * Declares the permission a route needs (spec §11). `org:*` checks the `:organizationId` route
 * param, `project:*` checks `:projectId`. Every non-public route must carry one: the guard fails
 * closed without it and the route-coverage test fails the build.
 */
export const Requires = (permission: Permission) => SetMetadata(REQUIRED_PERMISSION, permission);
