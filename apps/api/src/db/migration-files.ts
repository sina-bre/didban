import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** `apps/api/migrations`, from both `src/db` (tests) and `dist/db` (built). */
export const MIGRATIONS_DIR = fileURLToPath(new URL("../../migrations", import.meta.url));

export type MigrationFile = {
  version: string;
  sql: string;
  checksum: string;
  transactional: boolean;
};

const NAME = /^\d{4}_[a-z0-9_]+\.sql$/;

/** Reads `NNNN_name.sql` files in order. A misnamed `.sql` file is an error, not silently skipped. */
export function readMigrations(dir: string): MigrationFile[] {
  const files = readdirSync(dir).filter((file) => file.endsWith(".sql"));
  const misnamed = files.filter((file) => !NAME.test(file));
  if (misnamed.length > 0) throw new Error(`Misnamed migration files: ${misnamed.join(", ")}`);

  return files.sort().map((file) => {
    const sql = readFileSync(join(dir, file), "utf8").replace(/\r\n/g, "\n");
    return {
      version: file.slice(0, -".sql".length),
      sql,
      checksum: createHash("sha256").update(sql).digest("hex"),
      transactional: !sql.startsWith("-- migrate:no-transaction"),
    };
  });
}
