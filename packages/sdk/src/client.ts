import type { Config } from "./config.js";
import { buildEvent, type EventInput } from "./events.js";
import { createIdentity } from "./identity.js";
import { EVENT_NAME_PATTERN, MAX_ID_LENGTH } from "./limits.js";
import { createPipeline } from "./pipeline.js";
import { createPrivacy } from "./privacy.js";
import { createReport, guardMethods } from "./report.js";
import { createScope } from "./scope.js";
import { startTracking } from "./start.js";
import { createStore } from "./storage.js";
import type { Analytics, Module, Properties, SdkEvent } from "./types.js";

const isEventName = (name: unknown): name is string =>
  typeof name === "string" && EVENT_NAME_PATTERN.test(name);
const isId = (id: unknown): id is string =>
  typeof id === "string" && id.length > 0 && id.length <= MAX_ID_LENGTH;

/** Runs the modules' page-view callbacks before the page view is queued. */
function announce(pages: ReturnType<Module>[], event: SdkEvent): SdkEvent {
  if (event.type === "page") for (const page of pages) page?.(event.url);
  return event;
}

/**
 * One live instance. `createAnalytics` itself reads nothing from the page: environment checks,
 * listeners and the first page view run on idle (addendum A2), or earlier on an explicit flush().
 * `shutdown()` before that start drops queued events: nothing was sent and no listener exists.
 * While `startTracking` runs, the state is still "idle", so the first page view is queued.
 */
export function createClient(config: Config, onShutdown: () => void): Analytics {
  const report = createReport(config);
  const scope = createScope();
  const store = createStore();
  const privacy = createPrivacy(config, store, () => pipeline.changed());
  const identity = createIdentity(config.identity, store);
  const pipeline = createPipeline(config, scope, privacy, report);
  let state: "idle" | "running" | "off" = "idle";
  const pages: ReturnType<Module>[] = [];
  const emit = (input: EventInput) => {
    if (state !== "off") pipeline.enqueue(announce(pages, buildEvent(input, identity)));
  };
  const start = () => {
    if (state !== "idle") return;
    state = startTracking({ config, scope, pipeline, privacy, emit, pages }) ? "running" : "off";
  };
  scope.idle(start);
  return guardMethods<Analytics>(
    {
      page: (properties?: Properties) => emit({ type: "page", properties }),
      track(name, properties) {
        if (!isEventName(name)) return report("INVALID_ARGUMENT", "invalid event name");
        emit({ type: "track", name, properties });
      },
      identify(userId) {
        if (!isId(userId)) return report("INVALID_ARGUMENT", "invalid userId");
        identity.setUserId(userId);
        emit({ type: "identify" });
      },
      reset: () => identity.reset(),
      setConsent: (consent) => privacy.setConsent(consent),
      optOut: () => privacy.optOut(),
      optIn: () => privacy.optIn(),
      flush() {
        start();
        return pipeline.flush();
      },
      shutdown() {
        if (state === "running") pipeline.beacon();
        state = "off";
        pipeline.stop();
        scope.dispose();
        onShutdown();
      },
    },
    report,
  );
}
