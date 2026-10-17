## 19. Definition of done

1. A clean machine (documented prerequisites only) can run the app locally from `README.md` steps.
2. Migrations succeed on an empty database; `analytics_app` role cannot run DDL.
3. A CLI-granted platform admin creates two organizations with separate owners. Each owner can log in, enable TOTP, invite a member, assign project access, create a project and environment (through the onboarding wizard), and obtain a write key.
4. Browser apps (the vanilla and the Next.js examples) initialize the SDK; a page view and a custom event reach the real API and are persisted. A server event with `$revenue`/`$currency` sent through a `write_server` key is persisted.
5. The dashboard shows those events through real queries. Cookieless/persistent mode, filters, comparison, goals with revenue, realtime, discovered pages with route grouping, data health, and export all work. After a deliberate misconfiguration (wrong origin), the live check reports `ORIGIN_NOT_ALLOWED` with the offending origin.
6. Owner B requesting any of owner A's project routes with real IDs gets `404` on every route; org members see only assigned projects; a platform admin who is not a member sees no analytics; write keys cannot read anything.
7. Invalid, oversized, future-dated, and stale payloads, rate limits, quota, and mid-batch DB failure all behave as specified.
8. SDK builds standalone, passes `publint`/`attw`, meets the size budget, installs from a packed tarball in an empty project.
9. Lint, typecheck, unit, integration, and E2E tests pass; production builds succeed (actual output attached).
10. systemd + Caddy deployment, rolling restart, graceful shutdown, backup and restore check are documented **and executed at least once**, with results recorded.
11. Documentation matches the implementation; known limitations listed.

### Final report must contain
What was implemented · resulting tree · decisions and reasons (link ADRs) · schema and indexes with `EXPLAIN` evidence · security and authorization boundaries · every command run with its actual result · test coverage and **untested areas stated explicitly** · load-test methodology with hardware and measured results · known limitations · next priorities drawn from section 3.2 and section 20.
