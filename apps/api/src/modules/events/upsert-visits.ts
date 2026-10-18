import type { VisitSummary } from "../../domain/summarize-visits.js";
import type { Tx, WriteTarget } from "./new-event.js";

// Spec §7 step 8: one bulk upsert for the visits touched by this batch. Merging into a stored
// visit: counts add up, the window widens, and the earlier start keeps entry page + first-touch
// attribution while the later end sets the exit page. Device and country stay from the first row.

export type VisitRow = VisitSummary & { visitorId: Buffer };

export async function upsertVisits(tx: Tx, target: WriteTarget, visits: VisitRow[]) {
  if (visits.length === 0) return;
  const rows = visits
    .map((visit) => ({
      ...visit,
      projectId: target.projectId,
      environmentId: target.environmentId,
    }))
    .sort((a, b) => a.visitId.localeCompare(b.visitId)); // stable lock order across requests
  await tx`
    INSERT INTO visits ${tx(rows)}
    ON CONFLICT (project_id, visit_id) DO UPDATE SET
      started_at = LEAST(visits.started_at, excluded.started_at),
      last_seen_at = GREATEST(visits.last_seen_at, excluded.last_seen_at),
      pageviews = visits.pageviews + excluded.pageviews,
      events = visits.events + excluded.events,
      exit_pathname = CASE WHEN excluded.last_seen_at >= visits.last_seen_at
        THEN COALESCE(excluded.exit_pathname, visits.exit_pathname)
        ELSE COALESCE(visits.exit_pathname, excluded.exit_pathname) END,
      entry_pathname = CASE WHEN excluded.started_at < visits.started_at
        THEN COALESCE(excluded.entry_pathname, visits.entry_pathname)
        ELSE COALESCE(visits.entry_pathname, excluded.entry_pathname) END,
      referrer_source = CASE WHEN excluded.started_at < visits.started_at
        THEN excluded.referrer_source ELSE visits.referrer_source END,
      channel = CASE WHEN excluded.started_at < visits.started_at
        THEN excluded.channel ELSE visits.channel END,
      utm_source = CASE WHEN excluded.started_at < visits.started_at
        THEN excluded.utm_source ELSE visits.utm_source END,
      utm_medium = CASE WHEN excluded.started_at < visits.started_at
        THEN excluded.utm_medium ELSE visits.utm_medium END,
      utm_campaign = CASE WHEN excluded.started_at < visits.started_at
        THEN excluded.utm_campaign ELSE visits.utm_campaign END,
      utm_term = CASE WHEN excluded.started_at < visits.started_at
        THEN excluded.utm_term ELSE visits.utm_term END,
      utm_content = CASE WHEN excluded.started_at < visits.started_at
        THEN excluded.utm_content ELSE visits.utm_content END`;
}
