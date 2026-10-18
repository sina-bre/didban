import type { NewEvent, Tx, WriteTarget } from "./new-event.js";

// Spec §7 step 8: multi-row INSERT in chunks, `ON CONFLICT DO NOTHING` on (project_id, event_id).
// A retried event is skipped, never stored twice; RETURNING tells which rows are new.

const COLUMNS = [
  "projectId",
  "environmentId",
  "eventId",
  "type",
  "occurredAt",
  "receivedAt",
  "visitorId",
  "source",
  "visitId",
  "userId",
  "name",
  "hostname",
  "pathname",
  "route",
  "revenue",
  "currency",
  "referrerHost",
  "referrerSource",
  "channel",
  "utmSource",
  "utmMedium",
  "utmCampaign",
  "utmTerm",
  "utmContent",
  "country",
  "region",
  "city",
  "browser",
  "browserMajor",
  "os",
  "deviceType",
  "screenClass",
  "language",
  "properties",
] as const;

export type InsertInput = {
  target: WriteTarget;
  events: readonly NewEvent[];
  visitIds: readonly (string | null)[];
  receivedAt: Date;
  chunkSize: number;
};

/** Returns the event IDs that were inserted (not duplicates). */
export async function insertEvents(tx: Tx, input: InsertInput): Promise<Set<string>> {
  const { target, receivedAt } = input;
  const rows = input.events.map((event, i) => {
    const { title: _title, properties, ...columns } = event;
    return {
      ...columns,
      projectId: target.projectId,
      environmentId: target.environmentId,
      source: target.source,
      visitId: input.visitIds[i] ?? null,
      receivedAt,
      properties: tx.json(properties),
    };
  });
  const inserted = new Set<string>();
  for (let start = 0; start < rows.length; start += input.chunkSize) {
    const chunk = rows.slice(start, start + input.chunkSize);
    const ids = await tx<{ eventId: string }[]>`
      INSERT INTO events ${tx(chunk, COLUMNS)} ON CONFLICT DO NOTHING RETURNING event_id`;
    for (const { eventId } of ids) inserted.add(eventId);
  }
  return inserted;
}
