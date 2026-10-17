import { migrate } from "../db/migrate.js";
import { MIGRATIONS_DIR } from "../db/migration-files.js";
import { requireVar } from "./test-env.js";

/** Vitest global setup: bring the test database to the latest schema once per run. */
export default async function setup(): Promise<void> {
  await migrate(requireVar("TEST_MIGRATION_DATABASE_URL"), MIGRATIONS_DIR, () => {});
}
