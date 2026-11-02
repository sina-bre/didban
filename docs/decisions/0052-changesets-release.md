# 0052 — Changesets release workflow (dry run only)

- Status: Accepted
- Date: 2026-11-02

## Context
Spec A7 and ADR 0011: releases through Changesets + GitHub Actions with npm provenance (trusted
publishing); only `@didban/analytics` and `@didban/react` are public; `packages/contracts` and the apps
stay `"private": true`; nothing is published without explicit owner approval. The repo has no remote
CI yet and the npm org `@didban` does not exist yet, so Stage 6d can only prepare and dry-run a release.

## Decision
- `@changesets/cli` 3.0.3 (current `latest`, config schema 4.0.1, checked in the installed package).
  `access: public`, `baseBranch: main` (git flow: releases come from `main`), default changelog
  generator (no GitHub token needed), `format: false` (the repo uses Biome, which Changesets does not
  drive). Private packages are not versioned (`privatePackages` default), so contracts stays private
  even though the 6d brief listed it: the spec wins.
- `fixed: [["@didban/analytics", "@didban/react"]]`: the adapter has a `^` peer range on the SDK, and
  0.x minors fall outside it; releasing both at the same version keeps the range valid (dry run shows
  `@didban/react` 0.2.0 with peer `^0.2.0`). Users install matching versions.
- `.github/workflows/release.yml`: on push to `main`, `changesets/action` v2 opens a draft "Version
  Packages" PR. After it merges, a `publish` job in the GitHub environment `npm` (owner must set it to
  require their approval) runs lint, package build + tests, `pnpm check:packages`, the dry run, then
  `changeset publish` with npm trusted publishing (`id-token: write`, no `NPM_TOKEN`, provenance from
  `publishConfig`). Least privilege: workflow `permissions: {}`, per-job grants; actions pinned to SHAs.
- `pnpm release:dry-run` (`scripts/release-dry-run.mjs`): publish plan, `changeset version` with a sample
  changeset in a throwaway git worktree, `pnpm publish --dry-run` and the tarball list per package.

## Consequences
- First release publishes 0.1.0 as is (no changeset needed; `publish-plan` lists both packages).
- Before the first real release the owner must: create the npm org `@didban`, push to GitHub, create
  the `npm` environment with themselves as required reviewer, register the workflow as a trusted
  publisher for both packages on npmjs.com, and allow Actions to create PRs. Untested until then:
  OIDC publishing through `pnpm publish` (pnpm 11 must exchange the token; npm needs ≥ 11.5.1).
- Revisit if the packages need independent versions (drop `fixed`, accept peer-range majors).
