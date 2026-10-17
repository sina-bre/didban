-- Run by scripts/dev-db.mjs inside each database as a superuser. Idempotent.
\set ON_ERROR_STOP on

REVOKE ALL ON SCHEMA public FROM PUBLIC;
ALTER SCHEMA public OWNER TO analytics_migrator;
GRANT USAGE ON SCHEMA public TO analytics_app;

-- Tables the migrator creates later are readable/writable by the app, never alterable.
ALTER DEFAULT PRIVILEGES FOR ROLE analytics_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO analytics_app;
ALTER DEFAULT PRIVILEGES FOR ROLE analytics_migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO analytics_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO analytics_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO analytics_app;
