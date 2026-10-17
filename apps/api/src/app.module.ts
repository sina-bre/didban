import { type DynamicModule, Module } from "@nestjs/common";
import { ConfigModule } from "./config/config.module.js";
import type { Env } from "./config/env.js";
import { DbModule } from "./db/db.module.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { HealthModule } from "./modules/health/health.module.js";
import { OrganizationsModule } from "./modules/organizations/organizations.module.js";
import { ProjectsModule } from "./modules/projects/projects.module.js";

/**
 * INSTANCE_ROLE (spec §14.0) decides which feature modules are mounted. Health is always on.
 * Ingestion modules join for `all|ingest` (Stage 3), management modules for `all|management` (Stage 2).
 */
@Module({})
export class AppModule {
  static register(env: Env): DynamicModule {
    const management =
      env.INSTANCE_ROLE === "ingest" ? [] : [AuthModule, OrganizationsModule, ProjectsModule];
    return {
      module: AppModule,
      imports: [ConfigModule.register(env), DbModule.register(env), HealthModule, ...management],
    };
  }
}
