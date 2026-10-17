# Didban

Didban (دیدبان, "observer"): self-hosted web analytics with a browser SDK. **Status: Phase 0 — specs and agent setup only, no code yet.**

- Product spec: [`docs/spec/`](docs/spec/README.md) (start with `22-addendum.md` for owner overrides)
- Plan and progress: [`docs/plan/phases.md`](docs/plan/phases.md), [`docs/plan/progress.md`](docs/plan/progress.md)
- Decisions: [`docs/decisions/`](docs/decisions/)
- Design system: [`docs/design-system/`](docs/design-system/README.md), reference shots in `design/reference/`
- Agent guide: [`CLAUDE.md`](CLAUDE.md); project skills in `.claude/skills/` (pinned in `skills-lock.json`)

## Restore the AI tooling on a new machine
```bash
npx skills experimental_install
```
MCP servers are declared in `.mcp.json`. On macOS/Linux replace `"command": "cmd", "args": ["/c", "npx", …]`
with `"command": "npx", "args": […]`. The `postgres` server needs `uv` and `ANALYTICS_DEV_DATABASE_URL`.
