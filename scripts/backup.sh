#!/usr/bin/env bash
# Nightly logical backup (spec §14.2): `pg_dump -Fc` of the didban database, kept for
# BACKUP_KEEP_DAYS. Runs as the `postgres` OS user (peer auth) from didban-backup.timer.
# Copy the backup directory off the box as well: a backup on the same disk is not a backup.
set -euo pipefail

DB=${DIDBAN_DB:-didban}
DIR=${BACKUP_DIR:-/var/backups/didban}
KEEP_DAYS=${BACKUP_KEEP_DAYS:-14}
umask 077

log() { printf '%s backup: %s\n' "$(date -u +%FT%TZ)" "$*"; }

stamp=$(date -u +%Y%m%dT%H%M%SZ)
file="$DIR/$DB-$stamp.dump"
partial="$DIR/.$DB-$stamp.dump.partial"
trap 'rm -f "$partial"' EXIT

install -d -m 0700 "$DIR"
log "dump $DB -> $file"
# daily_salts holds only the schema: salts are destroyed daily (spec §12) and must not outlive that
# in a backup. A restored instance creates a fresh salt.
pg_dump --format=custom --compress=6 --exclude-table-data=daily_salts --file="$partial" "$DB"
# A dump that pg_restore cannot list is not kept under the final name.
pg_restore --list "$partial" >/dev/null
mv "$partial" "$file"
log "ok: $(du -h "$file" | cut -f1)"

removed=$(find "$DIR" -maxdepth 1 -name "$DB-*.dump" -type f -mtime "+$((KEEP_DAYS - 1))" -print -delete | wc -l)
log "retention: removed $removed dump(s) older than $KEEP_DAYS days"
