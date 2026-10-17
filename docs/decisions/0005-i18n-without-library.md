# 0005 — i18n and RTL without an i18n library

- Status: Accepted
- Date: 2026-10-17

## Context
Owner wants multi-language, RTL + LTR, and no heavy i18n bundle (addendum A4). i18next + react-i18next is
~15–20 KB gz before messages; FormatJS is larger. Browsers already ship `Intl`: numbers, dates, plurals,
relative time, display names, and even `calendar: "persian"`.

## Decision
- Formatting: one module `shared/lib/format.ts` wrapping `Intl.*`, with formatters cached per locale.
- Messages: `messages/en.ts` is the source of truth (`as const`). Other locales are typed
  `Record<MessageKey, string>`, so a missing key is a type error. Loaded with dynamic `import()`.
- `t(key, params)`: `{name}` interpolation, plural forms via `Intl.PluralRules`. About 30 lines.
- Direction from the locale: `<html dir="rtl">` for `fa`/`ar`/`he`, else `ltr`.
- Layout uses CSS logical properties only (lint-enforced, ADR 0002).

## Consequences
Zero dependencies, ~0.5 KB. No ICU select/nested plurals. If translators need them, revisit with
Paraglide JS (compile-time, tree-shaken), not a runtime library.
