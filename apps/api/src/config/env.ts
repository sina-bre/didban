import { isIP } from "node:net";
import { z } from "zod";

// Spec §12: validate all configuration at startup and fail fast.
const trustProxy = z
  .string()
  .default("0")
  .transform((value, ctx) => {
    if (/^\d$/.test(value)) return Number(value); // hop count 0–9
    const cidrs = value.split(",").map((part) => part.trim());
    if (cidrs.every((cidr) => isIP(cidr.split("/")[0] ?? "") !== 0)) return cidrs;
    ctx.addIssue({
      code: "custom",
      message: "use a hop count (0-9) or a comma-separated CIDR list",
    });
    return z.NEVER;
  });

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    HOST: z.string().default("127.0.0.1"),
    PORT: z.coerce.number().int().min(1).max(65_535).default(5100),
    PUBLIC_ORIGIN: z.url({ protocol: /^https?$/ }),
    INSTANCE_ROLE: z.enum(["all", "ingest", "management"]).default("all"),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
    TRUST_PROXY: trustProxy,
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    DB_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
    // Spec §11: `secure` = __Host-sid (https only); `insecure-dev` = plain sid over local http.
    SESSION_COOKIE: z.enum(["secure", "insecure-dev"]).default("secure"),
  })
  .superRefine((env, ctx) => {
    const url = new URL(env.PUBLIC_ORIGIN);
    if (env.SESSION_COOKIE === "secure" && url.protocol !== "https:") {
      ctx.addIssue({
        code: "custom",
        path: ["SESSION_COOKIE"],
        message: "secure cookies need an https PUBLIC_ORIGIN; set insecure-dev for local http",
      });
    }
    if (env.NODE_ENV !== "production") return;
    if (env.SESSION_COOKIE !== "secure") {
      ctx.addIssue({
        code: "custom",
        path: ["SESSION_COOKIE"],
        message: "production requires secure",
      });
    }
    const hostname = url.hostname.replace(/^\[|\]$/g, "");
    if (url.protocol !== "https:" || isIP(hostname) !== 0) {
      ctx.addIssue({
        code: "custom",
        path: ["PUBLIC_ORIGIN"],
        message: "production requires an https origin with a hostname, not an IP (spec §14.0)",
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export class InvalidEnvError extends Error {}

/** Parses `process.env`-like input. Throws InvalidEnvError listing every bad variable. */
export function loadEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (result.success) return result.data;
  const lines = result.error.issues.map((issue) => `  ${issue.path.join(".")}: ${issue.message}`);
  throw new InvalidEnvError(`Invalid environment configuration:\n${lines.join("\n")}`);
}
