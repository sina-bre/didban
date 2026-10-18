import type { Analytics } from "../types.js";
import { MAX_PROPERTY_STRING_LENGTH } from "./property.js";

/**
 * Feature catalog §23.1: call from your 404 page. Sends `page_not_found` with the `path` (no
 * query string). Analytics never sees HTTP status codes, so 404s are not detected automatically.
 */
export function notFound(analytics: Analytics, path?: string): void {
  if (typeof window === "undefined") return;
  analytics.track("page_not_found", {
    path: (path ?? window.location.pathname).slice(0, MAX_PROPERTY_STRING_LENGTH),
  });
}
