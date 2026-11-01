// Process helpers for the operations scripts (deploy, backup, restore-check) on Linux and Windows.
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const win = process.platform === "win32";

export const log = (scope, message) =>
  console.log(`${new Date().toISOString().slice(0, 19)}Z ${scope}: ${message}`);

/** A PostgreSQL client program; `PG_BIN` points at its directory when it is not on PATH. */
export const pg = (program) =>
  process.env.PG_BIN ? join(process.env.PG_BIN, win ? `${program}.exe` : program) : program;

function spawn(command, args, options, stdio) {
  // .cmd shims (pnpm on Windows) need a shell; every other program runs without one.
  const shell = win && /^(pnpm|npm|corepack)$/.test(command);
  const result = spawnSync(command, args, { encoding: "utf8", shell, stdio, ...options });
  if (result.error) throw new Error(`${command}: ${result.error.message}`);
  if (result.status !== 0) {
    const detail = stdio === "inherit" ? "" : `\n${result.stderr}`;
    throw new Error(`${command} ${args.join(" ")} exited with ${result.status}${detail}`);
  }
  return result;
}

/** Runs a program with inherited output; throws when it fails. */
export const run = (command, args, options = {}) => {
  spawn(command, args, options, "inherit");
};

/** Runs a program and returns its trimmed standard output; throws when it fails. */
export const capture = (command, args, options = {}) =>
  spawn(command, args, options, ["ignore", "pipe", "pipe"]).stdout.trim();
