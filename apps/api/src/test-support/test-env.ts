import { type Env, loadEnv } from "../config/env.js";

/** Reads a variable written by `pnpm db:setup`; fails loudly instead of skipping DB tests. */
export function requireVar(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Run \`pnpm db:setup\` (writes it to .env).`);
  return value;
}

/** Env for tests: the real test database, logging off. */
export function testEnv(overrides: Record<string, string> = {}): Env {
  return loadEnv({
    NODE_ENV: "test",
    PUBLIC_ORIGIN: "http://localhost:5173",
    DATABASE_URL: requireVar("TEST_DATABASE_URL"),
    DB_POOL_MAX: "2",
    SESSION_COOKIE: "insecure-dev",
    ...overrides,
  });
}
