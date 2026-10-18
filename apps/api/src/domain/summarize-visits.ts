// Spec §4: per-visit totals from the events that were actually stored (duplicates excluded).
// Entry / exit = first / last page pathname. Source attribution is first-touch: the first page
// event's UTM + referrer (the first event of any type when the batch has no page event).
// The writer merges these rows into stored visits (earlier start wins attribution and entry).

export type Attribution = {
  referrerSource: string | null;
  channel: number;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
};
export type VisitEvent = Attribution & {
  visitId: string;
  isPage: boolean;
  occurredAt: Date;
  pathname: string;
  country: string | null;
  browser: string | null;
  os: string | null;
  deviceType: number | null;
};
export type VisitSummary = Attribution & {
  visitId: string;
  startedAt: Date;
  lastSeenAt: Date;
  entryPathname: string | null;
  exitPathname: string | null;
  pageviews: number;
  events: number;
  country: string | null;
  browser: string | null;
  os: string | null;
  deviceType: number | null;
};

function attribution(event: VisitEvent): Attribution {
  const { referrerSource, channel, utmSource, utmMedium, utmCampaign, utmTerm, utmContent } = event;
  return { referrerSource, channel, utmSource, utmMedium, utmCampaign, utmTerm, utmContent };
}

function summarize(visitId: string, events: VisitEvent[]): VisitSummary {
  const pages = events.filter((event) => event.isPage);
  const [first] = events;
  if (!first) throw new Error("a visit summary needs at least one event");
  const last = events[events.length - 1] ?? first;
  return {
    ...attribution(pages[0] ?? first),
    visitId,
    startedAt: first.occurredAt,
    lastSeenAt: last.occurredAt,
    entryPathname: pages[0]?.pathname ?? null,
    exitPathname: pages[pages.length - 1]?.pathname ?? null,
    pageviews: pages.length,
    events: events.length,
    country: first.country,
    browser: first.browser,
    os: first.os,
    deviceType: first.deviceType,
  };
}

export function summarizeVisits(events: readonly VisitEvent[]): VisitSummary[] {
  const byVisit = new Map<string, VisitEvent[]>();
  const sorted = [...events].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  for (const event of sorted) {
    const list = byVisit.get(event.visitId) ?? [];
    list.push(event);
    byVisit.set(event.visitId, list);
  }
  return [...byVisit].map(([visitId, list]) => summarize(visitId, list));
}
