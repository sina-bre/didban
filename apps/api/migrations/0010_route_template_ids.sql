-- Spec §10 `…/routes` CRUD (ADR 0027). Positions shift when a template is inserted, moved or
-- deleted, so the API addresses templates by a stable ID instead. The table holds at most 200
-- rows per project and few projects use it, so adding the column with a default is cheap.
ALTER TABLE route_templates
  ADD COLUMN id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE;
