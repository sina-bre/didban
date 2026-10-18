// Spec §7 step 6 "route grouping". Minimal syntax: literal segments, `:name` for exactly one
// segment, and a final `*` for the rest (zero or more segments). Matching compares segments one by
// one, so there is no regex and no backtracking (ReDoS-free by construction).

export type RouteTemplate = { pattern: string; segments: readonly string[]; rest: boolean };

const LITERAL = /^[A-Za-z0-9._~%@#-]+$/; // `#` for hash-routed apps ("/#/settings")
const PARAM = /^:[A-Za-z][A-Za-z0-9_]{0,31}$/;
export const MAX_ROUTE_TEMPLATE_LENGTH = 200;

/** Parses a template such as `/products/:id` or `/blog/*`; `null` when the syntax is invalid. */
export function parseRouteTemplate(pattern: string): RouteTemplate | null {
  if (!pattern.startsWith("/") || pattern.length > MAX_ROUTE_TEMPLATE_LENGTH) return null;
  const parts = pattern === "/" ? [] : pattern.slice(1).split("/");
  const rest = parts.at(-1) === "*";
  const segments = rest ? parts.slice(0, -1) : parts;
  const valid = segments.every((part) => LITERAL.test(part) || PARAM.test(part));
  return valid ? { pattern, segments, rest } : null;
}

function matches(template: RouteTemplate, parts: readonly string[]): boolean {
  const { segments, rest } = template;
  if (rest ? parts.length < segments.length : parts.length !== segments.length) return false;
  return segments.every((segment, i) => segment.startsWith(":") || segment === parts[i]);
}

/** The first matching template in the given order (by `position`), or `null`. */
export function findRoute(templates: readonly RouteTemplate[], pathname: string): string | null {
  const trimmed = pathname.replace(/^\/+|\/+$/g, "");
  const parts = trimmed === "" ? [] : trimmed.split("/");
  return templates.find((template) => matches(template, parts))?.pattern ?? null;
}

/** What ingestion stores in `route`: the matching template, else the pathname itself. */
export const matchRoute = (templates: readonly RouteTemplate[], pathname: string): string =>
  findRoute(templates, pathname) ?? pathname;
