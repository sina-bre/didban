# 0013 — Event properties are flat

- Status: Accepted (locked by spec §6.2)
- Date: 2026-10-17

## Decision
`properties` is a flat JSON object: ≤ 20 keys; values are a string ≤ 255 chars, a finite number, a boolean, or null.
No nesting, no arrays. `$revenue` and `$currency` are the only reserved keys.

## Consequences
Breakdowns are a plain `properties ->> key` with a validated key. No JSON path language, bounded row size.
