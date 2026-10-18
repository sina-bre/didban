import type { Config } from "./config.js";
import type { Privacy } from "./privacy.js";
import { createQueue } from "./queue.js";
import type { Report } from "./report.js";
import type { Scope } from "./scope.js";
import { createSender } from "./sender.js";
import type { SdkEvent } from "./types.js";

export interface Pipeline {
  enqueue(event: SdkEvent): void;
  start(): void;
  /** Drops everything queued and sends nothing more. */
  stop(): void;
  flush(): Promise<void>;
  /** Page hide / shutdown: queued and waiting events go out with sendBeacon. */
  beacon(): void;
  /** Re-evaluate after consent or opt-out changes. */
  changed(): void;
}

/** `beforeSend` gets a copy, so a hook that throws half-way cannot alter what fails open. */
function applyBeforeSend(config: Config, event: SdkEvent, report: Report): SdkEvent | null {
  if (!config.beforeSend) return event;
  try {
    return config.beforeSend({ ...event, properties: { ...event.properties } }) ?? null;
  } catch (error) {
    report("BEFORE_SEND_FAILED", error instanceof Error ? error.message : String(error));
    return config.failOpen ? event : null;
  }
}

/** One pending interval timer at most; a full batch flushes at once. */
function createScheduler(scope: Scope, intervalMs: number, flush: () => unknown) {
  let armed = false;
  return (full: boolean) => {
    if (full) return void flush();
    if (armed) return;
    armed = true;
    scope.timeout(() => {
      armed = false;
      flush();
    }, intervalMs);
  };
}

export function createPipeline(
  c: Config,
  scope: Scope,
  privacy: Privacy,
  report: Report,
): Pipeline {
  const queue = createQueue(c.maxQueueSize, (n) =>
    report("QUEUE_OVERFLOW", `dropped ${n} event(s)`),
  );
  const sender = createSender(c, scope, report);
  let started = false;
  let chain = Promise.resolve();
  const ready = () => {
    const decision = privacy.decision();
    if (decision === "drop") queue.clear();
    return started && decision === "send";
  };
  const drain = async () => {
    while (ready() && queue.size > 0) await sender.send(queue.take(c.maxBatchSize));
  };
  const flush = () => {
    chain = chain.then(drain);
    return chain;
  };
  const scheduler = createScheduler(scope, c.flushIntervalMs, flush);
  const schedule = () => {
    if (ready() && queue.size > 0) scheduler(queue.size >= c.maxBatchSize);
  };
  return {
    enqueue(event) {
      const final = privacy.decision() === "drop" ? null : applyBeforeSend(c, event, report);
      if (final) queue.push(final);
      schedule();
    },
    start() {
      started = true;
      void flush();
    },
    stop() {
      started = false;
      queue.clear();
    },
    flush,
    beacon() {
      const events = ready() ? [...sender.waiting(), ...queue.take(queue.size)] : [];
      if (events.length > 0) sender.beacon(events);
    },
    changed: schedule,
  };
}
