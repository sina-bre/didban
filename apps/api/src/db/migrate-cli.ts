import { migrate } from "./migrate.js";
import { MIGRATIONS_DIR } from "./migration-files.js";

// `pnpm db:migrate` (dev DB) or `pnpm db:migrate -- --test` (test DB). Deploys call this once (spec §14.2).
const variable = process.argv.includes("--test")
  ? "TEST_MIGRATION_DATABASE_URL"
  : "MIGRATION_DATABASE_URL";
const url = process.env[variable];
if (!url) {
  console.error(`${variable} is not set. Run \`pnpm db:setup\` first (dev) or set it (deploy).`);
  process.exit(1);
}

const applied = await migrate(url, MIGRATIONS_DIR);
console.log(
  applied.length === 0 ? "Database is up to date." : `Applied ${applied.length} migration(s).`,
);
