-- Project settings' audit tab (Stage 5e): one project's entries, newest first, keyset on id.
CREATE INDEX audit_logs_project_idx ON audit_logs (project_id, id DESC)
  WHERE project_id IS NOT NULL;
