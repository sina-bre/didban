## 3. Product scope

### 3.1 v1 (required for Definition of Done)

**Tracking**
- Page views (SPA-aware), custom events with flat properties, `identify` (opt-in per project).
- Opt-in auto-capture modules: outbound link clicks, file downloads, scroll depth (25/50/75/100), engaged time.
- Explicit-only capture for everything else. No form field capture, no DOM text capture, no keystrokes.
- **Server-side events** (purchases, completed orders, webhook outcomes) through the same ingestion API with a `write_server` key, over plain HTTP (documented `curl` and `fetch` examples). Browser tracking cannot see these; the application must report them (section 3.4). The Node SDK stays in v1.1.
- **Revenue on events** through the reserved properties `$revenue` and `$currency` (section 6.2).
- **Thin React adapter** as a separate package (`@didban/react`: provider + `useAnalytics`), plus a Next.js App Router example. The core SDK stays framework-independent.

**Reports**
- **Overview:** visitors, visits, page views, views per visit, bounce rate, visit duration. Time series with automatic interval (hour/day/week/month). Previous-period comparison with deltas.
- **Realtime:** last 30 minutes. Active visitors (events in the last 5 min), active pages, recent events, top sources. Polling every 10 s, no WebSockets.
- **Pages:** top pages, entry pages, exit pages, and a **discovered pages** list: every route that has received traffic, with first seen, last seen, and latest title. A row opens a page detail view (views, visitors, entry/exit share, engaged time, top referrers to that page). Routes are grouped by project-defined **route templates** (`/products/:id`) so dynamic paths do not explode the report (section 7, step 6).
- **Data health:** last event time, events per hour for the last 7 days, ingestion rejections by code (invalid key, origin not allowed, rate limited, invalid payload), and the most frequent rejected origins. This is how an operator debugs "I installed the SDK and see nothing".
- **Sources:** referrers, channel groups, UTM source/medium/campaign/term/content.
- **Geo:** country and region. Requires the GeoLite2 file.
- **Devices:** browser, browser major version, OS, device type, screen-size class, language.
- **Events:** event counts, unique visitors per event, property key/value breakdown for a selected event.
- **Goals:** named conversion definitions (match on event name, or on pageview path pattern). Conversion rate per goal.
- **Filters:** any dimension above, plus event name and property equality. Filter state lives in the URL so views are shareable.
- **Date range:** presets (today, last 24h, 7d, 30d, 90d, 12 months, custom) in the project's reporting time zone.
- **CSV export** of any breakdown table.
- **Public share links:** read-only dashboard link per project, revocable, token stored hashed.

**Management**
- **Organizations are first-class in v1.** A platform admin creates an organization and its first owner. Users can belong to several organizations and switch between them. Organization roles: `owner`, `admin`, `member`. Project roles for members: `project_admin`, `viewer` (section 11).
- Projects → environments (`production`, `staging`, ...) → keys.
- **Onboarding wizard:** create project → create environment → copy key and snippet → live check that the first event arrived (section 13.4).
- Per-environment allowed origins, internal-traffic exclusions (IP/CIDR), retention, reporting time zone, identity mode, session timeout.
- Invites, user management, audit log viewer.
- Data deletion by date range, by visitor, by user ID.

### 3.2 v1.1 (only after the Definition of Done is met, in this order)
1. Funnels: 2–8 ordered steps, visit-scoped, configurable window.
2. Read-only stats API keys.
3. Annotations on the time series.
4. Web Vitals module (LCP, INP, CLS).
5. Node.js server SDK (until then, server events use the documented HTTP contract).
6. Email digest (requires SMTP).

### 3.3 Out of scope
Session replay, heatmaps, ad-network attribution, ML, feature flags, A/B testing, retention cohorts, billing, SSO/OAuth, microservices, Kubernetes, containers, custom query language, automatic DOM capture, cross-site user stitching, **server-side fetching of any user-supplied URL** (no sitemap crawling or site scanning: SSRF risk; route lists are entered or uploaded by an authenticated admin).

### 3.4 Capability boundaries (reproduce this table in `docs/integration.md` and on the in-app integration page)

Installing the SDK does not give the platform access to a site. It collects only what is configured and sends it to the collector. The platform learns about pages only from traffic it receives.

| Information | Collected? |
|---|---|
| Page views, visited URLs, titles, referrers | Yes, automatically once the SDK is initialized |
| SPA navigation (React/Next.js) | Yes, through History API handling (section 8.3) |
| UTM parameters | Yes, allowlisted query parameters only |
| Browser, OS, device class, language, screen class | Yes, normalized from browser metadata (raw UA is not stored) |
| Visitors and visits | Yes, per the identity rules in section 4 |
| Button clicks | Only through explicit `track()` calls or opt-in modules (outbound links, downloads, scroll depth) |
| Purchases, completed orders, signups | **No.** The application must report the business event, from the browser or from the server |
| Backend/API requests, server-side activity | **No.** Browser tracking cannot see them. Report meaningful outcomes as server events |
| Routes nobody has visited, or the site's source code | **No.** The discovered-pages list contains only routes that received traffic. Route templates group paths but do not discover anything |
| Private user data, database records, form contents, passwords | **No.** Never collected |

Example: the SDK records `/`, `/products`, `/checkout` page views. It cannot know the purchase succeeded because someone visited `/checkout`. That requires an explicit `purchase_completed` event with `$revenue`/`$currency`.
