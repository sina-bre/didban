-- Stage 6c (ADR 0050): `events` and `visits` grow by millions of rows and lose large slices to
-- retention and data deletion. The default thresholds (20 % dead rows, 20 % new rows) let dead
-- index entries pile up between vacuums, and range scans pay for them (measured in ADR 0050).
-- Vacuum at 2 % dead rows (the cost limit keeps each run gentle), analyze at 2 % changes, and
-- vacuum inserts at 5 % so the visibility map stays current for index-only scans.
ALTER TABLE events SET (
  autovacuum_vacuum_scale_factor = 0.02,
  autovacuum_vacuum_insert_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02
);
ALTER TABLE visits SET (
  autovacuum_vacuum_scale_factor = 0.02,
  autovacuum_vacuum_insert_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02
);
