## 0. Inputs the human must supply

| Input | Needed by | If missing |
|---|---|---|
| UI template folder at `./ui-template/` (with its license file) | Stage 5 | Complete Stages 1–4 first. At Stage 5, stop and report. Do not invent a UI and do not install a component library as a substitute. |
| Dashboard hostname (e.g. `analytics.<your-domain>`) | Stage 6 docs and deploy files | Use `analytics.example.com` as a placeholder. Never assume the dashboard lives on a tracked site. |
| Tracked sites (the first real site and its framework, e.g. a React/Next.js site) | Stage 3 examples | Build the vanilla and Next.js examples against `localhost` origins. |
| MaxMind GeoLite2 `.mmdb` file + license acceptance | Optional | Geo reports are disabled. The dashboard shows a "not configured" state. Never fake country data. |
| SMTP credentials | Not needed in v1 | Out of scope. Password reset is CLI/owner-driven (section 11). |

> Addendum override: the UI input is a set of design screenshots (`design/reference/*.webp`), not a code template. See `docs/spec/22-addendum.md` §A3.
