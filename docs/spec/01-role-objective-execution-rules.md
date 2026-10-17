## 1. Role, objective, execution rules

Act as a senior TypeScript architect and full-stack engineer. Build a self-hosted web analytics platform (Umami/Plausible-class) with a standalone browser SDK publishable to npm.

**Primary objective:** a working vertical slice: browser SDK → ingestion API → PostgreSQL → analytics API → React dashboard. It must run on a real machine, not only in tests.

Rules, in force for the whole task:

1. Before writing code: inspect the repository (files, manifests, lockfile, Git state, uncommitted changes, existing instructions). Never overwrite uncommitted work.
2. Write a short plan based on what exists. Define the domain model, module boundaries, API contracts, security model and DB strategy before building anything that depends on them.
3. Build in the stage order of section 18. The app must build and start after every stage. Do not begin a stage with the previous one broken.
4. Run format, lint, typecheck, migrations, tests, builds. **Never claim a check passed unless you ran it and saw it pass.** Paste real output in the final report.
5. No mock data, hardcoded metrics, placeholder services, fake responses, empty repository implementations, or `TODO` stubs in shipped paths.
6. **Do not trust remembered package APIs or config shapes.** NestJS, Prisma, Zod, TanStack Query, React Router, Vite, Vitest, `@nestjs/throttler` and every other dependency have changed config and API surface across majors. Read the installed version's docs/types before using it. List every version you installed in `docs/decisions/0001-stack.md`.
7. Verify the license of every dependency (e.g. `ua-parser-js` 2.x is AGPL-3.0; do not use it without an explicit decision). Record the result in `docs/licenses.md`.
8. When a requirement is missing: choose the simplest production-appropriate option, record it as an ADR, continue. Ask only if the gap blocks implementation (the only known blocker is the UI template path).
9. Documentation describes what exists, never what is planned.
10. Every optimization, infrastructure addition, or abstraction beyond this spec requires a measured trigger from section 20. No trigger, no addition.
