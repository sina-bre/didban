# Contributing

## Setup
Prerequisites: Node 24 (`.nvmrc`), pnpm 11, PostgreSQL 16+ installed natively. No containers.
```bash
pnpm install
pnpm lint && pnpm typecheck && pnpm test
```

## Rules that CI enforces
- **Small files:** ≤ 100 lines target, 150 hard limit (tests 250). Functions ≤ 40 lines. Split by use case.
- **RTL-safe UI:** logical CSS only (`ms-`, `pe-`, `start-`, `text-start`), never `ml-`, `right-`, `text-left`.
- Biome formatting and lint (`pnpm format` fixes most issues).

## Pull requests
- One concern per PR. Conventional commit titles (`feat(sdk): …`, `fix(api): …`).
- Changes to published packages (`packages/sdk`, `packages/react`) need a changeset (`pnpm changeset`).
- New dependencies: state the license and the bundle/runtime cost in the PR.
- Architecture decisions: add an ADR in `docs/decisions/` (copy `0000-template.md`).
