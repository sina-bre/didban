# 0021 — Development ports in the 5000 range

- Status: Accepted
- Date: 2026-10-17

## Context
The owner wants every local service in the 5000 range. Port 3000 is crowded on dev boxes (a stale
API held it twice) and 5000 is taken by macOS AirPlay Receiver.

## Decision
API **5100** (`PORT` default and `.env.example`), dashboard Vite **5173** with `strictPort`
and an `/api` proxy to the API (same origin in the browser), PostgreSQL **5432** (its standard
port; changing it would mean editing the server's own config for no gain). All bind 127.0.0.1.
Production is unchanged: Caddy serves 443 and proxies to the API on 127.0.0.1.

## Consequences
Existing `.env` files with `PORT=3000` keep working; set `PORT=5100` to match the docs.
`strictPort` makes a port clash fail loudly instead of silently moving to another port.
