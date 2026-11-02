# Releasing the npm packages

Public packages: `@didban/analytics` (`packages/sdk`) and `@didban/react` (`packages/react`), released
together at one version (ADR 0052). Everything else is private. **Nothing is published without the
owner's explicit approval** (spec A7, ADR 0011).

## Day to day
1. A change to a public package adds a changeset: `pnpm changeset` (pick packages + bump, one line).
   Breaking SDK API changes (any bump while on 0.x that removes or changes behaviour) need a migration
   note in the changeset text.
2. Merging to `main` makes the Release workflow open or update the draft "Version Packages" PR
   (versions, `CHANGELOG.md`, peer range of `@didban/react`).
3. Merging that PR starts the `publish` job. It waits for the owner's approval (environment `npm`),
   then runs lint, builds, tests, `pnpm check:packages`, `pnpm release:dry-run` and
   `changeset publish` (npm trusted publishing with provenance, git tags, GitHub releases).

## Dry run (local, safe)
```bash
pnpm build
pnpm check:packages
pnpm release:dry-run
```
The dry run prints the publish plan (read-only registry lookups), runs `changeset version` with a
sample changeset in a temporary git worktree (this checkout is untouched), then
`pnpm publish --dry-run` and the tarball file list of each package. It never uploads, tags or pushes.

## One-time setup before the first release (owner)
- Create the npm org `@didban`; push the repo to GitHub.
- Repository settings → Environments → `npm`: required reviewer = owner; Actions → General: allow
  GitHub Actions to create pull requests.
- npmjs.com → each package → Trusted publishers: GitHub Actions, workflow `release.yml`, environment
  `npm`. No `NPM_TOKEN` secret is used. The first release publishes 0.1.0 as is. If npmjs.com only
  offers trusted publishers for packages that already exist, check npm's current docs for the
  first-publish path before creating any token.

Not yet verified: OIDC trusted publishing through `pnpm publish` in CI (needs the steps above).
