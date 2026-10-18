import { createClient } from "./client.js";
import { resolveConfig } from "./config.js";
import { createReport } from "./report.js";
import type { Analytics, AnalyticsOptions } from "./types.js";

const noop: Analytics = Object.freeze({
  page() {},
  track() {},
  identify() {},
  reset() {},
  setConsent() {},
  optOut() {},
  optIn() {},
  flush: () => Promise.resolve(),
  shutdown() {},
});

const instances = new Map<string, { client: Analytics; warned: boolean }>();

/**
 * Spec §8.1/§8.3. On the server (no `window`) it returns a no-op instance and touches no browser
 * global. One instance per `(endpoint, writeKey)`: a second call returns the first instance and
 * warns once, which absorbs React StrictMode double effects and HMR re-runs. Never throws.
 */
export function createAnalytics(options: AnalyticsOptions): Analytics {
  if (typeof window === "undefined" || typeof document === "undefined") return noop;
  try {
    const config = resolveConfig(options);
    const key = `${config.url}\n${config.writeKey}`;
    const existing = instances.get(key);
    if (existing) {
      if (!existing.warned) console.warn("[didban] reusing instance");
      existing.warned = true;
      return existing.client;
    }
    const client = createClient(config, () => instances.delete(key));
    instances.set(key, { client, warned: false });
    return client;
  } catch (error) {
    const onError = typeof options?.onError === "function" ? options.onError : () => {};
    createReport({ onError, debug: options?.debug === true })(
      "INVALID_OPTIONS",
      error instanceof Error ? error.message : String(error),
    );
    return noop;
  }
}
