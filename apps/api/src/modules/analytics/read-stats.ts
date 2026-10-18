import type { Sql } from "../../db/db.module.js";

// Spec §10: stats queries run in a read-only transaction with a 10 s statement timeout, so a slow
// query cannot pile up and analytics can never write (apps/api/CLAUDE.md).
export function readStats<T>(sql: Sql, run: (tx: Sql) => Promise<T>): Promise<T> {
  return sql.begin("read only", async (tx) => {
    await tx`SET LOCAL statement_timeout = '10s'`;
    return run(tx as unknown as Sql);
  }) as Promise<T>;
}
