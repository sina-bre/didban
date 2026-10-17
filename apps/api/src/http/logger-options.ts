import type { FastifyServerOptions } from "fastify";
import type { Env } from "../config/env.js";

// Spec §12: redact secrets, never log payloads. We also drop the client IP and query strings
// (query strings can carry tokens) from request logs.
const REDACT = [
  "req.headers.authorization",
  "req.headers.cookie",
  "req.headers['x-write-key']",
  "res.headers['set-cookie']",
  "*.password",
  "*.token",
  "*.secret",
  "*.writeKey",
];

type RequestLike = { id: string; method: string; url: string };

export function loggerOptions(env: Env): FastifyServerOptions["logger"] {
  if (env.NODE_ENV === "test") return false;
  return {
    level: env.LOG_LEVEL,
    redact: { paths: REDACT, censor: "[redacted]" },
    serializers: {
      req: (req: RequestLike) => ({
        id: req.id,
        method: req.method,
        path: req.url.split("?")[0],
      }),
    },
  };
}
