-- Run by scripts/dev-db.mjs as a superuser. Idempotent. Spec §9.5: migrator = DDL, app = DML only.
\set ON_ERROR_STOP on

SELECT 'CREATE ROLE analytics_migrator LOGIN'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'analytics_migrator') \gexec
SELECT 'CREATE ROLE analytics_app LOGIN'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'analytics_app') \gexec

ALTER ROLE analytics_migrator WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD :'migrator_pw';
ALTER ROLE analytics_app WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD :'app_pw';
ALTER ROLE analytics_app SET statement_timeout = '15s';
ALTER ROLE analytics_app SET idle_in_transaction_session_timeout = '30s';
ALTER ROLE analytics_app SET lock_timeout = '5s';

-- didban_shadow is Prisma's scratch DB for `migrate dev`, so the migrator never needs CREATEDB.
SELECT format('CREATE DATABASE %I OWNER analytics_migrator', name)
FROM unnest(ARRAY['didban_dev', 'didban_test', 'didban_shadow']) AS name
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = name) \gexec
