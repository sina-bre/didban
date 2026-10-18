import type { EventSource } from "@didban/contracts";
import type postgres from "postgres";
import type { Attribution } from "../../domain/summarize-visits.js";

// The `EventWriter` boundary (spec §5.2): ingestion hands over fully enriched, identified events;
// the writer owns visits, `pages_seen` and usage. Field names map 1:1 to `events` columns.

export type Tx = postgres.TransactionSql;

/** The write key's scope: events never name their own project or environment (spec §6.1). */
export type WriteTarget = {
  projectId: string;
  environmentId: string;
  source: EventSource;
  sessionTimeoutMinutes: number;
};

export type NewEvent = Attribution & {
  eventId: string;
  type: 1 | 2 | 3;
  occurredAt: Date;
  visitorId: Buffer;
  userId: string | null;
  name: string | null;
  hostname: string;
  pathname: string;
  route: string;
  revenue: number | null;
  currency: string | null;
  referrerHost: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  browser: string | null;
  browserMajor: number | null;
  os: string | null;
  deviceType: number | null;
  screenClass: number | null;
  language: string | null;
  properties: Record<string, string | number | boolean | null>;
  /** Not an `events` column: feeds `pages_seen.last_title`. */
  title: string | null;
};

export type WriteResult = { inserted: number; duplicates: number; pagesOverflowed: number };
