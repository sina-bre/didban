# 0039 — SDK start in short idle steps

- Status: Accepted
- Date: 2026-10-19

## Context
Addendum A2: no SDK task over 5 ms on the host page, checked by `e2e/tests/perf.spec.ts` (median of
the longest task over three traced page loads). The script-tag build failed about 1 run in 3 at
5.02–5.1 ms. Traces showed two long tasks: `EvaluateScript` of `didban.iife.js` (V8 parse plus
`createAnalytics`) and the idle start, which ran checks, modules, listeners, the first storage read
(~1–2 ms on a fresh page), the first page view and the first send in one callback.

## Decision
The idle start runs only the environment checks, the opt-out link, modules and page-hide listeners.
Storage warm-up, automatic page views and the first send are each their own `scope.idle` callback.
`scope.settle()` runs pending idle callbacks at once (each runs once), and `flush()`, page hide and
`shutdown()` call it, so the first page view is never lost between steps. The script-tag entry only
reads its data attributes during evaluation; `window.analytics` is defined at once as forwarders
and the instance is created by a 0 ms timeout or by the first call. The 5 ms limit is unchanged.

## Consequences
Measured per task (script tag): idle steps 0.8–2.3 ms (were up to 4.6), `EvaluateScript` ~2 ms
typical (parse bound). Core stays under budget (4991 of 5000 B gz) after dropping `uuidv7`'s
`Math.random` fallback; with 9 B left, the next core feature needs bytes found elsewhere or a
budget decision. Revisit if `EvaluateScript` alone approaches the limit (bundle growth): then the
IIFE would need to load the core lazily.
