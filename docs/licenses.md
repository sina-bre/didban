# Licenses

Didban itself: MIT (ADR 0011). Dependency check from the lockfile, re-run in Stage 6d
(2026-11-02) with `pnpm licenses list --prod --json` (per package with `-F`) and `pnpm licenses list`.

## Shipped at runtime
| What ships | Licenses (package count) |
|---|---|
| `@didban/analytics`, `@didban/react` | No runtime dependencies (react is a peer, MIT) |
| API (`@didban/api`) | MIT 72, BSD-3-Clause 5, Apache-2.0 4, ISC 4, Unlicense 2 (`postgres`, `isbot`), 0BSD 1 |
| Dashboard bundle (`@didban/dashboard`) | MIT 45, ISC 12, Apache-2.0 8, BSD-3-Clause 2, OFL-1.1 2 (Inter, Vazirmatn fonts), MIT AND ISC 1, 0BSD 1 |

All are permissive and compatible with MIT distribution. Obligations: keep the license notices of
bundled code (Vite keeps `@license` comments; the font packages carry their OFL text), and do not
sell the fonts on their own (OFL-1.1).

## Development and examples only (not shipped)
- MPL-2.0: `axe-core`, `@axe-core/playwright` (a11y tests), `lightningcss` (CSS build). Used
  unmodified; file-level copyleft does not reach our code.
- Apache-2.0 AND LGPL-3.0-or-later: `@img/sharp-*` (libvips), pulled in by `next` in
  `examples/nextjs-app-router` only.
- CC-BY-4.0: `caniuse-lite` (browser data for build tools). CC0-1.0: `mdn-data`.
  BlueOak-1.0.0, MIT-0, BSD-2-Clause, `(MIT AND Zlib)`, `(MIT OR CC0-1.0)`, `MIT OR Apache-2.0`.
- `@react-aria/optimize-locales-plugin` 2.1.0 reports "Unknown": its package has no `license`
  field, but ships an Apache-2.0 `LICENSE` file (checked). Build plugin only.

## Data files
- `apps/api/data/common-passwords.txt`: SecLists 10k list, MIT (owner-approved 2026-10-17, ADR 0017).
- GeoLite2 databases are **not** bundled: operators download them with their own MaxMind account
  under MaxMind's GeoLite2 EULA (attribution required where geo data is shown publicly).
- No AGPL or GPL dependency (e.g. `ua-parser-js` 2.x is not used; spec §1 rule 7).
