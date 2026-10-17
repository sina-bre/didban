# 0001 — Stack and versions

- Status: Accepted. Versions are **candidates** until installed in Stage 1; then the lockfile versions replace this table.
- Date: 2026-10-17

## Context
Spec §1.6 and §2. Versions checked with `npm view` on 2026-10-17. Two traps found:
`prisma@latest` points at an RC (`8.0.0-rc.23`), and `typescript@latest` is 7.0.2, which
`typescript-eslint` and much tooling do not support yet (peer range `<6.1.0`).

## Decision
| Area | Package | Candidate | License |
|---|---|---|---|
| Runtime | Node | 24 LTS (24.18.0 on dev box) | MIT |
| Package manager | pnpm | 11.21 | MIT |
| Language | typescript | **6.0.3** (not 7.x) | Apache-2.0 |
| API | @nestjs/core | 12.1 | MIT |
| DB access | postgres (postgres.js), no ORM (ADR 0016) | 3.4.9 | Unlicense |
| HTTP | @nestjs/platform-fastify 12.1.3 + fastify 5.12.5 (ADR 0015) | | MIT |
| Build (API) | @swc/core 1.16.18, @swc/cli 0.8.1, unplugin-swc 2.0.0 | | Apache-2.0 / MIT |
| Validation | zod | 4.6 | MIT |
| DB | PostgreSQL | 18 on dev, ≥ 16 supported | PostgreSQL |
| Passwords | @node-rs/argon2 | 2.2 (prebuilt binaries, no node-gyp on Windows) | MIT |
| TOTP | otpauth | 9.5 | MIT |
| UA parsing | bowser 2.14 or my-ua-parser 2.0, decided in 3b by size/accuracy test. **Not ua-parser-js 2.x (AGPL).** | | MIT |
| Bots | isbot | 5.2 | Unlicense |
| Geo | maxmind | 5.0 | MIT |
| Logs | pino 10 + nestjs-pino 5 | | MIT |
| Metrics | prom-client | 15.1 | Apache-2.0 |
| SPA | react / react-dom | 19.3 | MIT |
| Build | vite | 8.3 | MIT |
| Styling | tailwindcss | 4.3 | MIT |
| Routing | react-router | 8.4 | MIT |
| Server state | @tanstack/react-query | 5.104 | MIT |
| Forms | react-hook-form | 7.90 | MIT |
| Dates | date-fns 4.4 + @date-fns/tz 1.5 | | MIT |
| Charts | recharts | 3.10 | MIT |
| A11y primitives | react-aria-components 1.22 (ADR 0004) | | Apache-2.0 |
| Fonts | @fontsource-variable/inter + /vazirmatn 5.3 | | OFL-1.1 |
| Tests | vitest 5.0, @playwright/test 1.64 | | MIT / Apache-2.0 |
| SDK build | tsdown 0.23 (fallback tsup 9) | | MIT |
| SDK checks | size-limit 14, publint 0.3, @arethetypeswrong/cli 0.18 | | MIT |
| Lint/format | @biomejs/biome 2.5 (ADR 0002) | | MIT / Apache-2.0 |
| Releases | @changesets/cli 3.0 | | MIT |

## Consequences
All of these are newer than the agent's memory: read installed types or use the context7 MCP.
`docs/licenses.md` is generated from the lockfile in Stage 1 and re-checked in Stage 6.
