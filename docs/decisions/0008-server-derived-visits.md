# 0008 — Visits are derived on the server

- Status: Accepted (locked by spec §4, §7.8)
- Date: 2026-10-17

## Decision
The SDK sends no session ID. Ingestion assigns events to visits inside one transaction per request, under a
per-visitor advisory lock, using the latest visit's `last_seen_at` and the project's session timeout.

## Consequences
One definition across SDK versions and server events; client clocks and multiple tabs cannot fork sessions.
Costs one indexed lookup per distinct visitor per batch (≤ 5 per browser batch).
