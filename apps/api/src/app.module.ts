import { type DynamicModule, Module } from "@nestjs/common";
import { ConfigModule } from "./config/config.module.js";
import type { Env } from "./config/env.js";
import { DbModule } from "./db/db.module.js";
import { ApiKeysModule } from "./modules/api-keys/api-keys.module.js";
import { AuditModule } from "./modules/audit/audit.module.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { EnvironmentsModule } from "./modules/environments/environments.module.js";
import { HealthModule } from "./modules/health/health.module.js";
import { IngestionModule } from "./modules/ingestion/ingestion.module.js";
import { OrganizationsModule } from "./modules/organizations/organizations.module.js";
import { ProjectsModule } from "./modules/projects/projects.module.js";
import { UsersModule } from "./modules/users/users.module.js";

/**
 * INSTANCE_ROLE (spec §14.0) decides which feature modules are mounted. Health is always on.
 * Ingestion joins for `all|ingest`, management modules for `all|management`.
 */
@Module({})
export class AppModule {
  static register(env: Env): DynamicModule {
    const management =
      env.INSTANCE_ROLE === "ingest"
        ? []
        : [
            AuthModule,
            OrganizationsModule,
            ProjectsModule,
            EnvironmentsModule,
            ApiKeysModule,
            AuditModule,
            UsersModule,
          ];
    const ingestion = env.INSTANCE_ROLE === "management" ? [] : [IngestionModule];
    return {
      module: AppModule,
      imports: [
        ConfigModule.register(env),
        DbModule.register(env),
        HealthModule,
        ...ingestion,
        ...management,
      ],
    };
  }
}
