#!/usr/bin/env bash
# Monthly restore check (spec §14.2): restore a dump (default: the newest) into a scratch
# database, run sanity counts against it and the live database, drop the scratch copy. Runs as
# the `postgres` OS user. Record the date and result in docs/deployment.md.
#   sudo -u postgres scripts/restore-check.sh [dump-file]
set -euo pipefail

DB=${DIDBAN_DB:-didban}
DIR=${BACKUP_DIR:-/var/backups/didban}
dump=${1:-$(find "$DIR" -maxdepth 1 -name "$DB-*.dump" -type f | sort | tail -n 1)}
scratch="${DB}_restore_check_$(date -u +%Y%m%d%H%M%S)"
TABLES=(schema_migrations organizations users projects environments visits events job_runs daily_salts)

log() { printf '%s restore-check: %s\n' "$(date -u +%FT%TZ)" "$*"; }
fail() { log "FAILED: $*"; exit 1; }
count() { psql -X -At -d "$1" -c "SELECT count(*) FROM $2"; }

[[ -n $dump && -r $dump ]] || fail "no readable dump in $DIR"
trap 'dropdb --if-exists "$scratch"' EXIT

log "restore $dump into $scratch"
createdb "$scratch"
start=$(date +%s)
# Owners and grants are not needed to check the data, and the roles may not exist on this host.
pg_restore --no-owner --no-acl --exit-on-error --jobs=2 --dbname="$scratch" "$dump"
log "restored in $(($(date +%s) - start)) s"

printf '%-18s %14s %14s\n' table restored live
for table in "${TABLES[@]}"; do
  restored=$(count "$scratch" "$table") || fail "table $table missing from the dump"
  live=$(count "$DB" "$table" 2>/dev/null || echo "-")
  printf '%-18s %14s %14s\n' "$table" "$restored" "$live"
done

dumped=$(count "$scratch" schema_migrations)
applied=$(count "$DB" schema_migrations 2>/dev/null || echo "$dumped")
((dumped == applied)) || log "note: live has $applied migrations, the dump $dumped (deploy since?)"
((dumped > 0)) || fail "no migrations recorded in the dump"
# daily_salts restores empty: backup.sh leaves its data out (spec §12).
# The newest event must be readable through the time index, not only counted.
latest=$(psql -X -At -d "$scratch" -c "SELECT coalesce(max(occurred_at)::text, 'none') FROM events")
log "newest event in the dump: $latest"
log "OK $(date -u +%F): $dump restores; counts above"
