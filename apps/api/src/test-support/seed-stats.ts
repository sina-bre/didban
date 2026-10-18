import type { Sql } from "../db/db.module.js";
import { uuidV7 } from "../domain/uuid-v7.js";

// Stats fixtures written with plain SQL at exact instants (ingestion would reject events older
// than 72 h). One SeedVisit = one `visits` row plus its events, consistent with what the writer
// stores: page events one minute apart, then track events, visit summary from those events.

export type Target = { projectId: string; environmentId: string };
export type SeedVisit = {
  /** Distinct number per visitor ID (cookieless: a new number per UTC day). */
  visitor: number;
  at: string;
  pages: string[];
  tracks?: string[];
  channel?: number;
  country?: string;
  browser?: string;
  properties?: Record<string, string>;
};

const MINUTE = 60_000;
const visitorId = (n: number) => Buffer.from(n.toString(16).padStart(32, "0"), "hex");

export async function seedVisit(sql: Sql, target: Target, v: SeedVisit): Promise<string> {
  const start = Date.parse(v.at);
  const visitId = uuidV7(start);
  const steps = [
    ...v.pages.map((p) => ({ type: 1, path: p })),
    ...(v.tracks ?? []).map((n) => ({ type: 2, name: n })),
  ];
  const last = start + (steps.length - 1) * MINUTE;
  const pages = v.pages.length;
  await sql`
    INSERT INTO visits (project_id, visit_id, environment_id, visitor_id, started_at, last_seen_at,
      entry_pathname, exit_pathname, pageviews, events, channel, country, browser)
    VALUES (${target.projectId}, ${visitId}, ${target.environmentId}, ${visitorId(v.visitor)},
      ${new Date(start)}, ${new Date(last)}, ${v.pages[0] ?? null}, ${v.pages.at(-1) ?? null},
      ${pages}, ${steps.length}, ${v.channel ?? 0}, ${v.country ?? null}, ${v.browser ?? null})`;
  const rows = steps.map((step, i) => {
    const at = start + i * MINUTE;
    const path = "path" in step ? step.path : (v.pages.at(-1) ?? "/");
    return {
      projectId: target.projectId,
      environmentId: target.environmentId,
      eventId: uuidV7(at),
      type: step.type,
      occurredAt: new Date(at),
      receivedAt: new Date(at),
      visitorId: visitorId(v.visitor),
      source: 1,
      visitId,
      name: "name" in step ? step.name : null,
      hostname: "heliumpark.example",
      pathname: path,
      route: path,
      channel: v.channel ?? 0,
      country: v.country ?? null,
      browser: v.browser ?? null,
      properties: sql.json(v.properties ?? {}),
    };
  });
  await sql`INSERT INTO events ${sql(rows)}`;
  return visitId;
}

/** A server-key event: no visit, counted in event totals but never as a visitor (spec §4). */
export async function seedServerEvent(sql: Sql, target: Target, at: string, name: string) {
  await sql`
    INSERT INTO events (project_id, environment_id, event_id, type, occurred_at, received_at,
      visitor_id, source, name, hostname, pathname, route, channel)
    VALUES (${target.projectId}, ${target.environmentId}, ${uuidV7(Date.parse(at))}, 2, ${at},
      ${at}, ${visitorId(999_999)}, 2, ${name}, 'shop.example', '/checkout', '/checkout', 0)`;
}
