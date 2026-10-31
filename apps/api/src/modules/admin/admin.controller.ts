import type {
  AdminInstanceResponse,
  AdminOrganizationListResponse,
  AdminUserListResponse,
} from "@didban/contracts";
import { Controller, Get, Inject } from "@nestjs/common";
import { ENV } from "../../config/config.module.js";
import type { Env } from "../../config/env.js";
import { SQL, type Sql } from "../../db/db.module.js";
import type { AccessScope } from "../../domain/permissions.js";
import { CurrentScope } from "../access/current-scope.js";
import { Requires } from "../access/requires.decorator.js";
import { instanceHealth } from "./instance-health.js";
import { listAdminOrganizations } from "./list-admin-organizations.js";
import { listAdminUsers } from "./list-admin-users.js";

/** Platform admin reads (spec §11, §13.3 `/admin/*`). Changes stay in their own modules. */
@Controller("admin")
export class AdminController {
  constructor(
    @Inject(SQL) private readonly sql: Sql,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Requires("platform")
  @Get("organizations")
  organizations(@CurrentScope() scope: AccessScope): Promise<AdminOrganizationListResponse> {
    return listAdminOrganizations(this.sql, scope);
  }

  @Requires("platform")
  @Get("users")
  users(@CurrentScope() scope: AccessScope): Promise<AdminUserListResponse> {
    return listAdminUsers(this.sql, scope);
  }

  @Requires("platform")
  @Get("instance")
  instance(@CurrentScope() scope: AccessScope): Promise<AdminInstanceResponse> {
    return instanceHealth(this.sql, { actor: scope, geoIp: Boolean(this.env.GEOIP_DB_PATH) });
  }
}
