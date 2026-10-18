// Spec §4 "Visit": consecutive events of one visitor with gaps ≤ the session timeout. Sessions are
// server-derived: the caller passes the visitor's stored visits near the batch, and every event joins the
// first known visit whose window [start − timeout, last seen + timeout] contains it, otherwise it
// starts a new visit. Events are processed in time order, so a batch delivered late still splits
// the same way as one delivered live.

export type KnownVisit = { visitId: string; startedAt: Date; lastSeenAt: Date };
export type VisitInput = { visitorKey: string; occurredAt: Date };

type Window = { visitId: string; start: number; last: number };

function findWindow(windows: Window[], at: number, timeoutMs: number): Window | undefined {
  return windows.find((w) => at >= w.start - timeoutMs && at <= w.last + timeoutMs);
}

/** Returns the visit ID for each input, in input order. */
export function assignVisits(
  events: readonly VisitInput[],
  known: ReadonlyMap<string, readonly KnownVisit[]>,
  options: { timeoutMs: number; newId: (at: number) => string },
): string[] {
  const windows = new Map<string, Window[]>();
  for (const [key, visits] of known) {
    const own = visits.map((v) => ({
      visitId: v.visitId,
      start: v.startedAt.getTime(),
      last: v.lastSeenAt.getTime(),
    }));
    windows.set(key, own);
  }
  const order = events
    .map((event, position) => ({ position, at: event.occurredAt.getTime(), key: event.visitorKey }))
    .sort((a, b) => a.at - b.at);
  const result: string[] = new Array(events.length);
  for (const { position, at, key } of order) {
    const own = windows.get(key) ?? [];
    let window = findWindow(own, at, options.timeoutMs);
    if (!window) {
      window = { visitId: options.newId(at), start: at, last: at };
      own.push(window);
      windows.set(key, own);
    }
    window.start = Math.min(window.start, at);
    window.last = Math.max(window.last, at);
    result[position] = window.visitId;
  }
  return result;
}
