/**
 * Owns every listener, timer and patch one instance creates, so `shutdown()` can undo all of them
 * (spec §8.3: no leaked listeners or timers). After `dispose()` nothing new is registered.
 */
export interface Scope {
  on(target: EventTarget, type: string, fn: EventListener, options?: AddEventListenerOptions): void;
  timeout(fn: () => void, ms: number): void;
  /** Resolves `true` after `ms`, or `false` as soon as the scope is disposed. */
  sleep(ms: number): Promise<boolean>;
  /** Runs `fn` when the browser is idle (`requestIdleCallback`, `setTimeout` fallback). */
  idle(fn: () => void): void;
  /** Runs the pending idle callbacks now, in order (each runs once). */
  settle(): void;
  add(cleanup: () => void): void;
  dispose(): void;
}

/** `requestIdleCallback` (`setTimeout` fallback); returns the cancel function. */
function requestIdle(fire: () => void): () => void {
  if (typeof requestIdleCallback !== "function") {
    const id = setTimeout(fire, 1);
    return () => clearTimeout(id);
  }
  const id = requestIdleCallback(fire, { timeout: 2000 });
  return () => cancelIdleCallback(id);
}

export function createScope(): Scope {
  const cleanups = new Set<() => void>();
  const idles = new Set<() => void>();
  let disposed = false;
  /** One-shot callback: `start` schedules `fire` and returns its cancel function. */
  const arm = (start: (fire: () => void) => () => void, fn: () => void) => {
    if (disposed) return;
    const fire = () => {
      cleanups.delete(cancel);
      fn();
    };
    const cancel = start(fire);
    cleanups.add(cancel);
  };
  const timeout = (fn: () => void, ms: number) =>
    arm((fire) => {
      const id = setTimeout(fire, ms);
      return () => clearTimeout(id);
    }, fn);
  const add = (cleanup: () => void) => (disposed ? cleanup() : cleanups.add(cleanup));
  return {
    on(target, type, fn, options) {
      if (disposed) return;
      target.addEventListener(type, fn, options);
      add(() => target.removeEventListener(type, fn, options));
    },
    timeout,
    sleep: (ms) =>
      new Promise((resolve) => {
        const cancel = () => resolve(false);
        if (disposed) return cancel();
        cleanups.add(cancel);
        timeout(() => {
          cleanups.delete(cancel);
          resolve(true);
        }, ms);
      }),
    idle(fn) {
      const run = () => !disposed && idles.delete(run) && fn();
      idles.add(run);
      arm(requestIdle, run);
    },
    settle() {
      for (const run of idles) run();
    },
    add: (cleanup) => void add(cleanup),
    dispose() {
      disposed = true;
      for (const cleanup of [...cleanups]) cleanup();
      cleanups.clear();
    },
  };
}
