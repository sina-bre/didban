import { EVENT_SOURCES, EVENT_TYPES } from "@didban/contracts";
import { Inject, Injectable } from "@nestjs/common";
import { ENV } from "../../config/config.module.js";
import type { Env } from "../../config/env.js";
import { SQL, type Sql } from "../../db/db.module.js";
import { summarizeVisits } from "../../domain/summarize-visits.js";
import { insertEvents } from "./insert-events.js";
import type { NewEvent, Tx, WriteResult, WriteTarget } from "./new-event.js";
import { resolveVisits } from "./resolve-visits.js";
import { upsertPagesSeen } from "./upsert-pages-seen.js";
import { upsertVisits } from "./upsert-visits.js";

// Spec §7 step 8: one transaction per request. Visits, `pages_seen` and usage are derived only
// from rows actually inserted, so a retried batch changes nothing. Server events create no
// visit and no discovered page. The usage row is the hot one per project: it goes last, so its
// lock is held only until commit.

@Injectable()
export class EventWriter {
  constructor(
    @Inject(SQL) private readonly sql: Sql,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async write(target: WriteTarget, input: NewEvent[], receivedAt: Date): Promise<WriteResult> {
    // The same event twice in one batch is a duplicate too: keep the first, count the rest.
    const seen = new Set<string>();
    const events = input.filter((e) => !seen.has(e.eventId) && seen.add(e.eventId));
    if (events.length === 0) return { inserted: 0, duplicates: 0, pagesOverflowed: 0 };
    return this.sql.begin(async (tx) => {
      await tx`SET LOCAL statement_timeout = '5s'`;
      const isBrowser = target.source === EVENT_SOURCES.browser;
      const visitIds = isBrowser ? await resolveVisits(tx, target, events) : [];
      const chunkSize = this.env.INGEST_INSERT_CHUNK;
      const ids = await insertEvents(tx, { target, events, visitIds, receivedAt, chunkSize });
      const stored = events.flatMap((event, i) =>
        ids.has(event.eventId) ? [{ ...event, visitId: visitIds[i] ?? "" }] : [],
      );
      let pagesOverflowed = 0;
      if (isBrowser) {
        await this.writeVisits(tx, target, stored);
        const pages = stored.filter((event) => event.type === EVENT_TYPES.page);
        pagesOverflowed = await upsertPagesSeen(tx, target, pages);
      }
      await addUsage(tx, target.projectId, receivedAt, stored.length);
      return {
        inserted: stored.length,
        duplicates: input.length - stored.length,
        pagesOverflowed,
      };
    });
  }

  private async writeVisits(
    tx: Tx,
    target: WriteTarget,
    stored: (NewEvent & { visitId: string })[],
  ) {
    const visitors = new Map(stored.map((event) => [event.visitId, event.visitorId]));
    const summaries = summarizeVisits(
      stored.map((event) => ({ ...event, isPage: event.type === EVENT_TYPES.page })),
    );
    const rows = summaries.map((s) => ({
      ...s,
      visitorId: visitors.get(s.visitId) ?? Buffer.alloc(0),
    }));
    await upsertVisits(tx, target, rows);
  }
}

async function addUsage(tx: Tx, projectId: string, receivedAt: Date, count: number) {
  if (count === 0) return;
  const day = receivedAt.toISOString().slice(0, 10);
  await tx`
    INSERT INTO project_usage_daily (project_id, day, events) VALUES (${projectId}, ${day}, ${count})
    ON CONFLICT (project_id, day) DO UPDATE SET events = project_usage_daily.events + excluded.events`;
}
