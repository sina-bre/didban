import type { Config } from "./config.js";

// Static environment checks, run once when the instance starts. A non-null reason (one word, for
// debug output) turns the instance into a silent no-op (spec §8.2 trackLocalhost/hostAllowlist,
// §8.3 lifecycle cases).

function isLocalHost(host: string): boolean {
  return (
    host === "localhost" || host.endsWith(".localhost") || host === "[::1]" || /^127\./.test(host)
  );
}

/** A cross-origin parent throws on `top.location` access: such iframes are not tracked. */
function parentReachable(): boolean {
  try {
    return window.top === window.self || typeof window.top?.location.href === "string";
  } catch {
    return false;
  }
}

export function blockedReason(config: Config): string | null {
  const { protocol, hostname } = window.location;
  if (protocol !== "http:" && protocol !== "https:") return "protocol";
  if (!parentReachable()) return "iframe";
  if (!config.trackLocalhost && isLocalHost(hostname)) return "localhost";
  if (config.hostAllowlist && !config.hostAllowlist.includes(hostname.toLowerCase())) {
    return "hostAllowlist";
  }
  return null;
}
