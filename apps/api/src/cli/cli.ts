import { InvalidEnvError, loadEnv } from "../config/env.js";
import { createSql, type Sql } from "../db/db.module.js";
import { createOwnerCommand } from "./create-owner-command.js";
import { platformAdminCommand } from "./platform-admin-command.js";
import { resetPasswordCommand } from "./reset-password-command.js";

// `pnpm cli <command> [args]`. Uses the app role (DML only), like the server.
const COMMANDS: Record<string, (sql: Sql, args: string[]) => Promise<number>> = {
  "create-owner": createOwnerCommand,
  "grant-platform-admin": platformAdminCommand(true),
  "revoke-platform-admin": platformAdminCommand(false),
  "reset-password": resetPasswordCommand,
};

const name = process.argv[2] ?? "";
const command = COMMANDS[name];
if (!command) {
  console.error(`Usage: pnpm cli <command>\nCommands: ${Object.keys(COMMANDS).join(", ")}`);
  process.exit(1);
}

let sql: Sql | undefined;
try {
  sql = createSql(loadEnv(process.env));
  process.exitCode = await command(sql, process.argv.slice(3));
} catch (error) {
  if (!(error instanceof InvalidEnvError)) throw error;
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await sql?.end({ timeout: 5 });
}
