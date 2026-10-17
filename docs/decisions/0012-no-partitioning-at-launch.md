# 0012 — No partitioning or rollups at launch

- Status: Accepted (locked by spec §9.4, §20)
- Date: 2026-10-17

## Decision
One `events` table with three indexes. Dedupe via the PK `(project_id, event_id)`. When a §20 trigger fires
(> 50 M rows, retention delete > 30 min, or index > 25% of RAM), move to monthly range partitions **and** a separate
unpartitioned `event_ids` dedupe table with a 72 h window, because skew correction changes `occurred_at`
between retries. Rollups only for additive counts, never for unique visitors.

## Consequences
Simple schema and queries now; the migration path is written down.
