// Where the browser goes after login (spec §13.4: the 401 redirect preserves the return path).

/** The landing page when there is no (usable) return path. */
export const HOME = "/";

type Place = Pick<Location, "pathname" | "search">;

/** `/login?next=<current path>`; the auth pages themselves are never a return path. */
export function loginHref(place: Place): string {
  const next = place.pathname + place.search;
  if (place.pathname === "/login" || place.pathname === "/set-password") return "/login";
  return `/login?next=${encodeURIComponent(next)}`;
}

/**
 * `?next=` only when it stays on this origin. `//evil.example`, `/\evil.example` and absolute
 * URLs resolve elsewhere, so they fall back to HOME (no open redirect).
 */
export function safeNext(value: string | null, origin = window.location.origin): string {
  if (!value?.startsWith("/")) return HOME;
  const url = new URL(value, origin);
  if (url.origin !== origin) return HOME;
  return url.pathname + url.search + url.hash;
}
