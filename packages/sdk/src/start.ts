import type { Config } from "./config.js";
import type { EventInput } from "./events.js";
import { blockedReason } from "./gate.js";
import { startPageviews } from "./pageviews.js";
import type { Pipeline } from "./pipeline.js";
import type { Privacy } from "./privacy.js";
import type { Scope } from "./scope.js";

export interface StartDeps {
  config: Config;
  scope: Scope;
  pipeline: Pipeline;
  privacy: Privacy;
  emit(input: EventInput): void;
}

/**
 * Runs once, on idle: environment checks, the opt-out link, page-hide delivery, automatic page
 * views, then the first send. Returns `false` when the environment is not tracked.
 */
export function startTracking({ config, scope, pipeline, privacy, emit }: StartDeps): boolean {
  const reason = blockedReason(config);
  if (reason) {
    pipeline.stop();
    if (config.debug) console.info(`[didban] off: ${reason}`);
    return false;
  }
  privacy.readOptOutLink();
  const hide = () => pipeline.beacon();
  scope.on(document, "visibilitychange", () => {
    if (document.visibilityState === "hidden") hide();
  });
  scope.on(window, "pagehide", hide);
  if (config.pageviews) {
    startPageviews(config, scope, (url, referrer) => emit({ type: "page", url, referrer }));
  }
  pipeline.start();
  return true;
}
