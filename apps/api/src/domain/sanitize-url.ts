// Spec §7 step 6 "URL sanitization": lowercase host (the URL parser does it), hash only for
// hash-routed apps, query reduced to `utm_*`, `ref`, `source` and the project's own names,
// bounded lengths, trailing slash per project setting.

export type UrlRules = {
  hashRouting: boolean;
  trailingSlash: "strip" | "keep";
  /** Project allowlist plus site-search parameters. */
  keepParams: readonly string[];
};

export type SanitizedUrl = { hostname: string; pathname: string; query: Record<string, string> };

const ALWAYS_KEPT = new Set(["ref", "source"]);
export const MAX_PATHNAME_LENGTH = 1024;
export const MAX_QUERY_VALUE_LENGTH = 255;

function keptQuery(params: URLSearchParams, keep: readonly string[]): Record<string, string> {
  const query: Record<string, string> = {};
  for (const [name, value] of params) {
    const wanted = name.startsWith("utm_") || ALWAYS_KEPT.has(name) || keep.includes(name);
    if (!wanted || name in query || value === "") continue;
    query[name] = value.slice(0, MAX_QUERY_VALUE_LENGTH);
  }
  return query;
}

function pathOf(url: URL, rules: UrlRules): string {
  let pathname = url.pathname;
  if (rules.trailingSlash === "strip" && pathname.length > 1)
    pathname = pathname.replace(/\/+$/, "");
  if (rules.hashRouting && url.hash.length > 1) pathname += url.hash.split("?")[0];
  return (pathname || "/").slice(0, MAX_PATHNAME_LENGTH);
}

/** `null` when the URL is not http(s) (validation already checked; this guards direct callers). */
export function sanitizeUrl(raw: string, rules: UrlRules): SanitizedUrl | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  return {
    hostname: url.hostname,
    pathname: pathOf(url, rules),
    query: keptQuery(url.searchParams, rules.keepParams),
  };
}
