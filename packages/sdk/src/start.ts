import type { Config } from "./config.js";
import type { EventInput } from "./events.js";
import { blockedReason } from "./gate.js";
import { startPageviews } from "./pageviews.js";
import type { Pipeline } from "./pipeline.js";
import type { Privacy } from "./privacy.js";
import type { Scope } from "./scope.js";
import type { Module } from "./types.js";

export interface StartDeps {
  config: Config;
  scope: Scope;
  pipeline: Pipeline;
  privacy: Privacy;
  emit(input: EventInput): void;
  /** Filled with the modules' page-view callbacks. */
  pages: ReturnType<Module>[];
}

/**
 * Runs once, on idle: environment checks, the opt-out link, modules, page-hide delivery, automatic
 * page views, then the first send. Returns `false` when the environment is not tracked. Modules
 * start before the page-hide listeners so their hide handlers queue events before the beacon.
 */
export function startTracking(deps: StartDeps): boolean {
  const { config, scope, pipeline, privacy, emit } = deps;
  const reason = blockedReason(config);
  if (reason) {
    pipeline.stop();
    if (config.debug) console.info(`[didban] off: ${reason}`);
    return false;
  }
  privacy.readOptOutLink();
  for (const start of config.modules) {
    if (typeof start === "function") deps.pages.push((start as Module)(emit, scope.on));
  }
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
