import { MAX_BEACON_BYTES } from "./limits.js";
import { type HttpResult, parseRetryAfter } from "./retry.js";

const HEADERS = { "Content-Type": "text/plain" };

interface ResponseBody {
  error?: { code?: unknown };
  rejected?: unknown;
}

async function readBody(res: Response): Promise<ResponseBody> {
  try {
    return ((await res.json()) as ResponseBody | null) ?? {};
  } catch {
    return {};
  }
}

/**
 * One POST with an AbortController timeout. `keepalive` lets the request outlive the page, but
 * browsers cap keepalive bodies at 64 KB, so larger bodies go without it. `null` = network
 * error or timeout. Never rejects.
 */
export async function post(
  url: string,
  body: string,
  timeoutMs: number,
): Promise<HttpResult | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      body,
      headers: HEADERS,
      credentials: "omit",
      keepalive: new TextEncoder().encode(body).length < MAX_BEACON_BYTES,
      signal: controller.signal,
    });
    const json = await readBody(res);
    const code = json.error?.code;
    return {
      status: res.status,
      ...(typeof code === "string" ? { code } : {}),
      retryAfterMs: parseRetryAfter(res.headers.get("Retry-After")),
      rejected: Array.isArray(json.rejected) ? json.rejected.length : 0,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Fire-and-forget delivery for page hide (spec §8.3): sendBeacon, keepalive fetch fallback. */
export function beacon(url: string, body: string): void {
  try {
    if (navigator.sendBeacon?.(url, body)) return;
  } catch {
    // fall back to fetch
  }
  fetch(url, {
    method: "POST",
    body,
    headers: HEADERS,
    credentials: "omit",
    keepalive: true,
  }).catch(() => {});
}
