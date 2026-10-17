## 7. Ingestion pipeline (ordered; each step is a separate, testable unit)

1. **Body limit** on the stream before parse. Reject with 413.
2. **Write-key auth:** resolve key → project + environment. In-process LRU cache, positive TTL 60 s, negative TTL 10 s. Revocation takes effect within 60 s per process. Document that bound.
3. **Origin check** (browser keys only): the `Origin` header must be in the environment's allowlist. This is a spam filter, not authentication. It is trivially spoofable outside a browser; say so in `docs/security.md`. Server keys skip it. Every rejection increments a bounded in-memory counter flushed once a minute to `ingestion_diagnostics` (code, hour bucket, count), plus the rejected origin string (truncated to 255 chars, capped at 20 distinct origins per environment per day). This feeds the Data Health page and is the main tool for "I installed the SDK and see nothing".
4. **Rate limit and quota:** per key and per IP (separate buckets). Quota counters in `project_usage_daily`, one upsert per batch.
5. **Parse and validate** the envelope, then each event with Zod. Invalid events are rejected individually (partial success), not the whole batch, except for envelope-level errors.
6. **Enrich:**
   - Client IP from `X-Forwarded-For` using an **explicit trusted-proxy configuration** (hop count or CIDR list). With no trusted proxy configured, use the socket address. Never trust the leftmost XFF entry blindly.
   - User-Agent parsing with an MIT/permissively licensed parser; store normalized browser/OS/device only. **Never store the raw UA or the IP.**
   - Geo lookup from the local `.mmdb` in-process (country/region; city only if the project enables it).
   - Bot filter: UA pattern list + headless markers + optional datacenter-ASN deny list. Drop silently, count in metrics.
   - Internal-traffic exclusion: per-environment IP/CIDR list. Localhost excluded unless `trackLocalhost` is set.
   - URL sanitization: lowercase host; strip hash unless hash-routing is enabled; **strip all query parameters except `utm_*`, `ref`, `source`, and the project's allowlist**; max length; normalize trailing slash per project setting.
   - Referrer: reduce to host (+ path only for allowlisted hosts), map to a source name via `data/sources.json`, assign channel.
   - **Route grouping:** match the sanitized pathname against the project's route templates (`/products/:id`, `/blog/*`). Templates use a documented minimal syntax (`:param` for one segment, trailing `*` for the rest) compiled to anchored matchers. **Never accept user-supplied raw regex (ReDoS).** First match by explicit `position` wins. Store the matched template in `route`, or the pathname itself when nothing matches.
   - PII guard (default `strip`): drop property values that look like emails or Luhn-valid 13–19 digit numbers; count drops. Applies to properties and allowlisted query values.
7. **Identity:** compute `visitor_id` per the project's identity mode (section 4).
8. **Visit resolution + write, one transaction per request:**
   - Take `pg_advisory_xact_lock(hashtextextended(project_id || visitor_id, 0))` for each distinct visitor, in sorted order.
   - One query to fetch each visitor's latest visit; assign events to visits in memory (new visit when the gap exceeds the timeout).
   - Bulk insert events: `createMany({ skipDuplicates: true })` (`ON CONFLICT DO NOTHING`). Chunk at a configurable size (default 500 rows). Never one INSERT per event.
   - One bulk upsert for `visits` (browser events only; server events create no visit), one for `project_usage_daily`, one for `pages_seen` (`ON CONFLICT` updates `last_seen_at` and `last_title`; capped per project, section 9.1).
   - Commit, then respond.
9. **Metrics + structured log** (counts and timings only, never payloads or keys).
