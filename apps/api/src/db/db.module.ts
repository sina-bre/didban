import {
  type DynamicModule,
  Global,
  Inject,
  Injectable,
  Module,
  type OnApplicationShutdown,
} from "@nestjs/common";
import postgres from "postgres";
import type { Env } from "../config/env.js";

/** Inject with `@Inject(SQL) private readonly sql: Sql`. */
export const SQL = Symbol("SQL");
export type Sql = postgres.Sql;

export function createSql(env: Env): Sql {
  return postgres(env.DATABASE_URL, {
    max: env.DB_POOL_MAX,
    idle_timeout: 30,
    connect_timeout: 5,
    transform: postgres.camel,
    onnotice: () => {},
  });
}

/** Closes the pool after in-flight requests have drained (spec §9.5 graceful shutdown). */
@Injectable()
class SqlLifecycle implements OnApplicationShutdown {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  async onApplicationShutdown(): Promise<void> {
    await this.sql.end({ timeout: 5 });
  }
}

@Global()
@Module({})
export class DbModule {
  static register(env: Env): DynamicModule {
    return {
      module: DbModule,
      providers: [{ provide: SQL, useFactory: () => createSql(env) }, SqlLifecycle],
      exports: [SQL],
    };
  }
}
