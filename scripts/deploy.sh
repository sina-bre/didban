#!/usr/bin/env bash
# Rolling deploy on one box (spec §14.2, docs/deployment.md). Run as root from a checkout of the
# version to deploy: `sudo scripts/deploy.sh`. Steps: build a new release as the app user,
# migrate once with the migrator role, switch `current`, publish the dashboard, then restart
# instance A, wait for its /ready, restart instance B. Migrations are expand/contract, so the old
# version keeps working against the new schema while B still runs it.
set -euo pipefail

SRC=$(cd "$(dirname "$0")/.." && pwd)
ROOT=${DIDBAN_ROOT:-/opt/didban}
WWW=${DIDBAN_WWW:-/srv/didban/www}
read -r -a PORTS <<<"${DIDBAN_PORTS:-5101 5102}"
KEEP=${DIDBAN_KEEP_RELEASES:-3}
SETTLE=${DIDBAN_SETTLE_SECONDS:-5} # > Caddy health_interval: the proxy sees A healthy again
APP_USER=didban
MIGRATOR_ENV=/etc/didban/migrator.env
release="$ROOT/releases/$(date -u +%Y%m%dT%H%M%SZ)"

log() { printf '%s deploy: %s\n' "$(date -u +%H:%M:%S)" "$*"; }
as_app() { # a clean environment: nothing of root's leaks into the build
  runuser -u "$APP_USER" -- env -i PATH="$PATH" HOME=/var/lib/didban LANG=C.UTF-8 CI=1 \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 "$@" </dev/null
}
wait_ready() {
  for _ in $(seq 1 60); do
    curl -fsS -o /dev/null "http://127.0.0.1:$1/api/v1/health/ready" && return 0
    sleep 1
  done
  log "instance $1 not ready after 60 s: stopping here (journalctl -u analytics-api@$1)"
  return 1
}

[[ $EUID -eq 0 ]] || { echo "deploy.sh: run as root" >&2; exit 1; }
[[ -r $MIGRATOR_ENV ]] || { echo "deploy.sh: $MIGRATOR_ENV missing" >&2; exit 1; }

# A failed build leaves no half-built release behind; after the switch the release is kept.
trap '[[ -L $ROOT/current && $(readlink "$ROOT/current") == "$release" ]] || rm -rf "$release"' EXIT

log "build $release from $SRC ($(git -C "$SRC" rev-parse --short HEAD 2>/dev/null || echo '?'))"
install -d -o "$APP_USER" -g "$APP_USER" "$release"
rsync -a --exclude .git --exclude node_modules --exclude dist --exclude '.env*' \
  --exclude test-results --exclude .claude "$SRC/" "$release/"
chown -R "$APP_USER:$APP_USER" "$release"
(cd "$release" && as_app pnpm install --frozen-lockfile && as_app pnpm build)
# Built code is root's: the API user can read it but never change what runs next time.
chown -R root:root "$release"

log "migrate (once, migrator role)"
(cd "$release/apps/api" && node --env-file="$MIGRATOR_ENV" dist/db/migrate-cli.js)

log "switch current -> $release"
ln -sfn "$release" "$ROOT/current.next"
mv -T "$ROOT/current.next" "$ROOT/current"

log "publish dashboard to $WWW"
install -d "$WWW"
# New hashed assets first, index.html last; old assets stay for open tabs, removed after 30 days.
rsync -a --exclude index.html "$release/apps/dashboard/dist/" "$WWW/"
install -m 0644 "$release/apps/dashboard/dist/index.html" "$WWW/index.html.next"
mv -f "$WWW/index.html.next" "$WWW/index.html"
find "$WWW/assets" -type f -mtime +30 -delete

for port in "${PORTS[@]}"; do
  log "restart analytics-api@$port"
  systemctl restart "analytics-api@$port"
  wait_ready "$port"
  log "analytics-api@$port ready"
  sleep "$SETTLE"
done

log "prune releases (keep $KEEP)"
find "$ROOT/releases" -mindepth 1 -maxdepth 1 -type d | sort | head -n "-$KEEP" | xargs -r rm -rf
log "done: $(readlink "$ROOT/current")"
