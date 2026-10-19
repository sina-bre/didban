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
 * Page views and the first send run as later idle tasks, so no single task gets long (addendum A2).
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
  /** Pending start steps run first, so the first page view goes out too. */
  const hide = () => {
    scope.settle();
    pipeline.beacon();
  };
  scope.on(document, "visibilitychange", () => {
    if (document.visibilityState === "hidden") hide();
  });
  scope.on(window, "pagehide", hide);
  // First storage access (opt-out flag) is slow on a fresh page: warm it in its own task.
  scope.idle(privacy.decision);
  if (config.pageviews) scope.idle(() => startPageviews(config, scope, emit));
  scope.idle(pipeline.start);
  return true;
}
