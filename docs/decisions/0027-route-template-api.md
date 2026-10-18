# 0027 — Route-template API

- Status: Accepted
- Date: 2026-10-18

## Context
Spec §10 asks for `…/routes` CRUD (project admin and above) plus `POST …/routes/preview`.
Spec §11 lists "route template change" in the audit log. Table `route_templates` (ADR 0026)
uses `(project_id, position)` as its primary key. Positions shift when a template is inserted,
moved or deleted, so they cannot identify a template between two requests. The primary key is
not deferrable, so `UPDATE … SET position = position + 1` can collide halfway through.

## Decision
- `migrations/0010` adds `id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE`. The API addresses
  templates as `/projects/:projectId/routes/:routeId`.
- Every change (create, move/rename, delete) runs in one transaction. It locks the project row
  (`FOR NO KEY UPDATE`, so foreign-key checks are not blocked), loads the ordered list, edits it
  in memory, then deletes the project's rows and re-inserts them with positions 1..n. That is at
  most 200 rows.
- `position` is optional on create (default: append) and clamped to the end of the list.
- Errors: bad syntax → 400 `VALIDATION_FAILED` (the parser lives in the API, like CIDRs);
  duplicate pattern → 409 `ROUTE_TEMPLATE_EXISTS`; 201st template → 409 `ROUTE_TEMPLATE_LIMIT`.
- Preview: 1–20 paths, optional unsaved `patterns` (≤ 200, checked like saved ones). It returns
  the matching pattern or `null`, using the same `findRoute` that ingestion uses.
- All five routes need `project:manage`. Listing is included because templates are a setting.
  Viewers get 403. Other tenants get 404.
- Audit: `route_template.created|updated|deleted`, target `route_template`, details = changed
  field names. The pattern is typed by a user, so it is not stored (ADR 0022).

## Consequences
- Ingestion sees changes within 60 s (settings cache, ADR 0026). This is not invalidated on write.
- Index check (test DB, 500 projects × 200 templates = 100k rows, `EXPLAIN (ANALYZE, BUFFERS)`):
  listing one project runs a bitmap scan on `route_templates_project_id_pattern_key`, 3 index
  buffers, 0.41 ms. The rewrite's `DELETE` uses the same plan, 0.62 ms. No query uses the new
  `id` index. It only enforces uniqueness, and writes are rare (admin edits).
- Revisit if templates grow past a few hundred per project. Then the rewrite should become an
  in-place shift with a deferrable key.
