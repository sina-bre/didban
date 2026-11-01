import type { Sql } from "../../db/db.module.js";

// One job process at a time across every API instance (spec §9.4 "guarded by advisory lock").
// A session-level lock lives on one connection, so it is taken on a reserved one; the work itself
// runs on the pool. Closing or releasing the connection also drops the lock.
const JOBS_LOCK = 727_002;

/** Runs `work` when this process gets the lock; returns `false` when another one holds it. */
export async function withJobLock(sql: Sql, work: () => Promise<void>): Promise<boolean> {
  const lock = await sql.reserve();
  try {
    const [row] = await lock<{ locked: boolean }[]>`
      SELECT pg_try_advisory_lock(${JOBS_LOCK}) AS locked`;
    if (!row?.locked) return false;
    try {
      await work();
    } finally {
      await lock`SELECT pg_advisory_unlock(${JOBS_LOCK})`;
    }
    return true;
  } finally {
    lock.release();
  }
}
