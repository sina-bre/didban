import type { Config } from "./config.js";
import type { AnalyticsError } from "./types.js";

export type Report = (code: string, message: string) => void;

/** Every failure ends here: `onError` (itself guarded) plus a console line in debug mode. */
export function createReport(config: Pick<Config, "onError" | "debug">): Report {
  return (code, message) => {
    const error = Object.assign(new Error(message), { code }) as AnalyticsError;
    if (config.debug) console.warn(`[didban] ${code}: ${message}`);
    try {
      config.onError(error);
    } catch {
      // A throwing onError must not break the host page.
    }
  };
}

/** Wraps every method of a public object so it never throws (spec §8.3). */
export function guardMethods<T extends object>(target: T, report: Report): T {
  const out: Record<string, unknown> = {};
  for (const [key, fn] of Object.entries(target)) out[key] = guard(key, fn, report);
  return out as T;
}

function guard(key: string, fn: (...args: unknown[]) => unknown, report: Report) {
  return (...args: unknown[]) => {
    try {
      const result = fn(...args);
      return result instanceof Promise ? result.catch(() => undefined) : result;
    } catch (error) {
      report("INTERNAL", error instanceof Error ? error.message : String(error));
      return key === "flush" ? Promise.resolve() : undefined;
    }
  };
}
