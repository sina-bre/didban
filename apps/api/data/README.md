# Bundled data

| File | Source | License | Used by |
|---|---|---|---|
| `common-passwords.txt` | [SecLists](https://github.com/danielmiessler/SecLists) `Passwords/Common-Credentials/10k-most-common.txt`, downloaded 2026-10-17 | MIT | `src/modules/auth/password-policy.ts` |

Only entries of 12+ characters can match (shorter passwords already fail the length rule).
Swapping in a larger list (for example the NCSC 100k list) needs no code change.

| File | Source | License | Used by |
|---|---|---|---|
| `sources.json` | Hand-written for didban (referrer host → source name/type) | MIT (this repo) | `src/modules/ingestion/enrich/referrer.ts` |
| `channels.json` | Hand-written from spec §4 (utm_medium / source type → channel) | MIT (this repo) | `src/modules/ingestion/enrich/channel.ts` |

Adding a source is a JSON edit plus a test case in `enrich-units.test.ts`; no code change.
