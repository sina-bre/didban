## 23. Feature catalog and boundaries (owner request 2026-10-17)

Every feature with: who uses it, what it does, **hard limits**, what it deliberately does **not** do, and the
acceptance check. Tags: **[v1]** already in spec §3.1 · **[v1+]** added to v1 by the owner (cheap: reuses
existing tables, no new infrastructure) · **[v1.2]** after the Definition of Done, in listed order.
A feature not in this file does not get built.

### 23.1 Tracking (SDK + ingestion)
| Feature | Tag | Does | Limits | Does not | Accept when |
|---|---|---|---|---|---|
| Page views | v1 | auto on load, SPA nav, bfcache restore | 1 per real URL change | count prerender, hash-only changes (unless hash mode) | Next.js `<Link>` + `router.push` → exactly 1 each |
| Custom events | v1 | `track(name, props)` | name regex §6.2; ≤ 20 flat props; 50 keys per event name | nested objects, arrays | invalid props rejected per event, rest of batch accepted |
| Identify | v1 | `identify(userId)` when project allows | ≤ 128 chars | store emails (PII guard drops them) | rejected + counted when project disallows |
| Outbound links / downloads | v1 | opt-in modules → events `outbound_click` / `file_download` with `url` property | ≤ 1 KB gz each; extensions list configurable | capture link text | module disabled → 0 bytes in bundle |
| Scroll depth / engaged time | v1 | 25/50/75/100 %; visible+focused time | 1 event per threshold per page view | track mouse movement | rAF-throttled, passive listeners |
| Server events + revenue | v1 | `write_server` key, `$revenue` + `$currency` | revenue ≤ 1e9, ISO 4217 | currency conversion | curl example lands, no visit created |
| **Site search** | v1+ | project setting `site_search_params` (e.g. `q`, `s`); value kept as `search_term` on the page view | ≤ 3 params, value ≤ 100 chars, PII guard applies | store other query params | report shows top terms + exit rate after search |
| **404 pages** | v1+ | SDK `notFound()` sends `page_not_found` with the path; docs for Next.js `not-found.tsx` | same as custom events | detect 404s automatically (we never see status codes) | report lists broken paths + referrers |
| **Opt-out link** | v1+ | visiting any page with `?no_track=1` sets local opt-out (persists in storage) | works in both identity modes | sync across devices | owner excludes own visits without IP rules |
| Ingestion debugger | v1+ | Data Health "last 20 rejected batches" (code, origin, time; **no payloads**) | ring buffer 20 per environment, in memory, per process | keep request bodies | wrong origin visible within 1 min |

### 23.2 Reports
| Report | Tag | Shows | Boundaries |
|---|---|---|---|
| Overview | v1 | 6 KPIs, time series, compare | totals are range-distinct counts, never bucket sums |
| Compare to **same period last year** | v1+ | `compare=previous_year` besides `previous_period` | same null-delta rule; ranges ≤ 366 days |
| Realtime | v1 | last 30 min, 10 s polling | never cached; pauses in hidden tab |
| Pages, entry/exit, discovered, detail | v1 | plus **scroll depth distribution and avg engaged time per page** [v1+] | only when the module is enabled; otherwise "not collected" |
| **Hostnames** | v1+ | breakdown + filter by hostname (multi-domain projects) | hostnames come from traffic only |
| Sources / channels / UTM | v1 | first-touch per visit | no multi-touch attribution |
| **Conversions by source** | v1+ | goal conversion rate per channel and per UTM campaign | browser events only (spec §4) |
| **Revenue by source** | v1+ | revenue per currency per channel/campaign | never summed across currencies; server events attributed only when they carry the visit's `anonymousId` (persistent mode), else "unattributed" |
| Geo, devices, events, properties | v1 | as spec | geo disabled without GeoLite2 file |
| **Site search** | v1+ | top terms, searches per visit, exit rate after search | see 23.1 |
| **404 report** | v1+ | broken paths, referrers that link to them | see 23.1 |
| Goals | v1 | counts, rate, revenue | ≤ 50 goals per project |
| Data health | v1 | spec §3.1 + debugger above | diagnostics kept 14 days |
| Funnels | v1.2 | 2–8 steps, visit-scoped | spec §3.2 |
| Annotations | v1.2 | notes on the time series | ≤ 500 per project |

### 23.3 Productivity
| Feature | Tag | Does | Limits / not |
|---|---|---|---|
| **Saved views** | v1+ | name and save a filter + range + compare combination per project; shared with project members | ≤ 50 per project; stores the URL query only |
| **Campaign URL builder** | v1+ | client-side form that builds a UTM link and copies it | pure frontend, no link shortener, no redirects |
| **Keyboard shortcuts** | v1+ | `/` filter, `d` date range, `c` compare, `g o/r/p/s` navigate, `?` help | never override typing in inputs |
| **Usage page** | v1+ | org owners see events per project per day vs quota | data from `project_usage_daily`; no billing |
| **Locale + digits** | v1+ | `en`/`fa` UI, Latin or Persian digits, Gregorian or Persian calendar display | storage and API stay UTC/ISO |
| CSV export | v1 | any breakdown table | ≤ 10 000 rows per export |
| Share links | v1 | read-only public view | revocable, hashed token, optional expiry date [v1+] |
| Embed share view | v1.2 | `?embed=1` hides chrome; per-link allowed frame ancestors | CSP `frame-ancestors` per link |
| Read-only stats API keys | v1.2 | spec §3.2 | |
| Email digest / alerts | v1.2 | needs SMTP (spec §20 trigger) | **no outbound webhooks to user URLs in v1** (SSRF) |

### 23.4 Boundaries that apply to everything
- **Never collected:** form contents, DOM text, keystrokes, mouse paths, raw IP, raw UA, full query strings,
  cookies of the host site, anything from routes nobody visited.
- **Never done:** session replay, heatmaps, fingerprinting beyond the daily-salted hash, cross-project stitching,
  fetching user-supplied URLs, sampling (all counts are exact), selling or sharing data, calling home.
- **Every list has a cap** (above, spec §6.2, §9.1); every cap has a metric and a visible warning when hit.
- **Host-site cost:** core SDK ≤ 5 KB gz, no long task > 5 ms, no network before idle (addendum A2).
- **Tenancy:** every v1+ feature above is project-scoped and goes through `AccessScope`; saved views and
  share links are covered by the isolation test suite like every other route.
