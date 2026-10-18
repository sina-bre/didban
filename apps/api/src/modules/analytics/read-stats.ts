import type { Sql } from "../../db/db.module.js";

// Spec §10: stats queries run in a read-only transaction with a 10 s statement timeout, so a slow
// query cannot pile up and analytics can never write (apps/api/CLAUDE.md).
// The planner cannot estimate how many groups `date_trunc(…, tz)` or a breakdown column yields and
// then avoids parallel plans that are 3× faster on large ranges (measured on 10 M events, ADR
// 0037). Cheaper parallel startup for these read-only transactions only, nothing global.
export function readStats<T>(sql: Sql, run: (tx: Sql) => Promise<T>): Promise<T> {
  return sql.begin("read only", async (tx) => {
    await tx`SET LOCAL statement_timeout = '10s'`;
    await tx`SET LOCAL parallel_setup_cost = 0`;
    await tx`SET LOCAL parallel_tuple_cost = 0`;
    return run(tx as unknown as Sql);
  }) as Promise<T>;
}
