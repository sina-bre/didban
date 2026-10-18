import { assignVisits, type KnownVisit } from "../../domain/assign-visits.js";
import { uuidV7 } from "../../domain/uuid-v7.js";
import type { NewEvent, Tx, WriteTarget } from "./new-event.js";

// Spec §7 step 8: one advisory lock per distinct visitor, taken in sorted order (no deadlocks),
// so concurrent batches of one visitor serialize and agree on one visit. Then one query reads
// the visitors' stored visits that overlap the batch's time span (index visits_visitor_idx),
// so a late event rejoins the visit it belongs to, and events are assigned in memory.

type KnownRow = KnownVisit & { visitorKey: string };

/** A visitor with this many visits inside one batch's span is a flood, not a person. */
const MAX_KNOWN_VISITS = 200;

export async function resolveVisits(
  tx: Tx,
  target: WriteTarget,
  events: readonly NewEvent[],
): Promise<string[]> {
  const keys = [...new Set(events.map((event) => event.visitorId.toString("hex")))].sort();
  for (const key of keys) {
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${`${target.projectId}${key}`}, 0))`;
  }
  const timeoutMs = target.sessionTimeoutMinutes * 60_000;
  const times = events.map((event) => event.occurredAt.getTime());
  const from = new Date(Math.min(...times) - timeoutMs);
  const to = new Date(Math.max(...times) + timeoutMs);
  const rows = await tx<KnownRow[]>`
    SELECT encode(visitor_id, 'hex') AS visitor_key, visit_id, started_at, last_seen_at
    FROM visits
    WHERE project_id = ${target.projectId}
      AND visitor_id IN (SELECT decode(key, 'hex') FROM unnest(${keys}::text[]) AS key)
      AND last_seen_at >= ${from} AND started_at <= ${to}
      AND environment_id = ${target.environmentId}
    ORDER BY last_seen_at DESC LIMIT ${MAX_KNOWN_VISITS}`;
  const known = new Map<string, KnownRow[]>();
  for (const row of rows) known.set(row.visitorKey, [...(known.get(row.visitorKey) ?? []), row]);
  const inputs = events.map((event) => ({
    visitorKey: event.visitorId.toString("hex"),
    occurredAt: event.occurredAt,
  }));
  return assignVisits(inputs, known, { timeoutMs, newId: (at) => uuidV7(at) });
}
