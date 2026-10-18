import type { Config } from "./config.js";
import { currentUrl } from "./events.js";
import { patchHistory } from "./history.js";
import type { Scope } from "./scope.js";

export type EmitPage = (url: string, referrer: string | undefined) => void;

/** `auto` counts the fragment only when it looks like a route (`#/…` or `#!/…`). */
const isHashRoute = (hash: string) => /^#!?\//.test(hash);

/**
 * Automatic page views (spec §8.3): initial load (after prerender activation), SPA navigation and
 * bfcache restores. A view is emitted only when the tracked URL (path + search, plus the hash when
 * hash routing applies) changes; navigations in one task are coalesced into one check.
 */
export function startPageviews(config: Config, scope: Scope, emit: EmitPage): void {
  const { spa } = config;
  let lastKey: string | null = null;
  let previousUrl: string | undefined = document.referrer || undefined;
  let pending = false;

  function check(force = false) {
    pending = false;
    const { pathname, search, hash } = window.location;
    const withHash = spa === "hash" || (spa === "auto" && isHashRoute(hash));
    const key = pathname + search + (withHash ? hash : "");
    if (key === lastKey && !force) return;
    lastKey = key;
    if (config.excludePaths.some((pattern) => pattern.test(pathname))) return;
    const url = currentUrl() + (withHash ? hash : "");
    emit(url, previousUrl);
    previousUrl = url;
  }

  const schedule = () => {
    if (pending) return;
    pending = true;
    scope.timeout(() => check(), 0);
  };

  if (spa !== "off") {
    scope.add(patchHistory(schedule));
    scope.on(window, "popstate", schedule);
    if (spa !== "history") scope.on(window, "hashchange", schedule);
  }
  scope.on(window, "pageshow", (event) => {
    if ((event as PageTransitionEvent).persisted) check(true);
  });
  if ((document as Document & { prerendering?: boolean }).prerendering) {
    scope.on(document, "prerenderingchange", () => check(), { once: true });
  } else {
    check();
  }
}
