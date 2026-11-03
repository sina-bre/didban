# Changesets

Every change to a published package (`@didban/analytics`, `@didban/react`) needs a changeset:
`pnpm changeset` → pick the packages and the bump → write one line for the changelog.
Breaking changes to the public SDK API also need a migration note in the changeset (spec A7).

Private packages (`apps/*`, `packages/contracts`, `examples/*`, `tools/*`, `e2e`) are not versioned.
Release flow and the dry run: `docs/releasing.md` (ADR 0052). Nothing is published without the owner.
