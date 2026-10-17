# Bundled data

| File | Source | License | Used by |
|---|---|---|---|
| `common-passwords.txt` | [SecLists](https://github.com/danielmiessler/SecLists) `Passwords/Common-Credentials/10k-most-common.txt`, downloaded 2026-10-17 | MIT | `src/modules/auth/password-policy.ts` |

Only entries of 12+ characters can match (shorter passwords already fail the length rule).
Swapping in a larger list (for example the NCSC 100k list) needs no code change.
