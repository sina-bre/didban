# 0011 — Open source and npm publishing

- Status: Accepted 2026-10-17 (license: MIT for the whole repo). npm scope: `@didban` (owner choice, 2026-10-17). The owner creates the free npm org before the first publish.
- Date: 2026-10-17

## Context
The owner may open-source the repo and publish the SDK. A publish is public and effectively permanent
(npm allows unpublish only within 72 h).

## Decision
- License: **MIT for the whole repo** (owner choice). `LICENSE` added in Stage 1a.
- Published: `@didban/analytics`, `@didban/react`. Everything else is `"private": true`.
- Scope `@didban`: `@didban/analytics` (SDK), `@didban/react` (adapter); private workspace packages also use `@didban/*`.
- Changesets for versions and changelogs. GitHub Actions trusted publishing with `--provenance`.
  `files` allowlist. `publint`, `attw` and a tarball install test run in CI before any publish.
- Repo files: LICENSE, README, CONTRIBUTING, SECURITY (private disclosure contact), CODE_OF_CONDUCT.
- Semver from 0.1.0. Public SDK API changes need a changeset and a migration note.

## Consequences
Nothing is published without explicit owner approval (spec §8.1).
