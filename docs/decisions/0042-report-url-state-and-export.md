# 0042 — Report URL state, filter values, export and goal management

- Status: Accepted
- Date: 2026-10-26

## Context
Stage 5d (spec §3.1, §10, §13.4): filters must live in the URL, the interval selector must offer
only sensible choices, any breakdown must export as CSV, and goals need a place to be defined
(spec §13.3 lists no goals settings route).

## Decision
- Filters are repeated `?filter=field:op:value`, the API's own syntax, read with the contract's
  `parseFilter` (invalid and repeated filters are dropped, at most 10). Report views and
  dimensions are `?view=` / `?by=`; the selected event and property are `?event=` / `?prop=`.
  Defaults are not written. `?interval=` is only honoured when it fits the range
  (hour ≤ 7 days, day ≥ 2, week ≥ 14, month ≥ 60); otherwise `auto`.
- "Add filter" values come from the picked field's own breakdown (limit 100) in the current range.
  Nothing is fetched before a field is picked. Breakdown rows are also links that add `field is value`.
- While a request loads, the previous rows stay only when the table is the same (only range,
  compare, filters or interval changed). A new `by`/`view` shows a skeleton instead of old rows.
- CSV export is a plain same-origin `<a download>` to `…/stats/export.csv`. It carries the table's
  query, and the browser streams the file, so there is no blob in memory and no extra JS.
- Goals are created and deleted on the Goals page by project managers (org owner/admin or
  project admin, from the project list's roles). The API still decides. Editing is left out:
  delete and re-create covers it with less UI.

## Consequences
Shared links reproduce a filtered view exactly. Switching sections keeps unrelated params
(`by`, `view`), and each report ignores values that are not its own. Revisit if goals get a
settings page (5e) or if filter values need search beyond the top 100.
