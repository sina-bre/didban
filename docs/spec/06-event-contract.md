## 6. Event contract (schema version 1)

### 6.1 Request

`POST /api/v1/ingest/batch`. **The browser SDK always sends a CORS-simple request:** `Content-Type: text/plain`, JSON body, write key in the body field `writeKey`. This avoids a preflight round trip on every cross-origin tracked site and works with `sendBeacon`. The server also accepts `application/json` and an `X-Write-Key` header (server keys, tools). Never accept the key in the URL. Still answer `OPTIONS` preflights correctly, with `Access-Control-Max-Age`, for clients that trigger them.

```json
{
  "schemaVersion": 1,
  "sentAt": "2026-10-17T06:23:10.123Z",
  "context": {
    "sdk": { "name": "@didban/analytics", "version": "0.1.0" },
    "locale": "en-US",
    "screen": { "w": 1440, "h": 900 },
    "timezone": "Asia/Tehran"
  },
  "events": [
    {
      "eventId": "0192f3a0-7b1c-7c3e-9f10-2a4d5e6f7a81",
      "type": "page",
      "occurredAt": "2026-10-17T06:23:09.870Z",
      "url": "https://app.example.com/pricing?utm_source=news",
      "referrer": "https://www.google.com/",
      "title": "Pricing",
      "anonymousId": "optional, persistent mode only",
      "userId": "optional, after identify",
      "properties": {}
    },
    {
      "eventId": "0192f3a0-7b1c-7c3e-9f10-2a4d5e6f7a82",
      "type": "track",
      "name": "signup_completed",
      "occurredAt": "2026-10-17T06:23:10.010Z",
      "url": "https://app.example.com/signup",
      "properties": { "method": "email", "plan": "pro", "seats": 3 }
    }
  ]
}
```

`projectId` and `environmentId` are **never** read from the body. The write key resolves them. `source` (`1` browser, `2` server) is derived from the key kind (`write_browser`, `write_server`) and is never read from the body.

### 6.2 Limits (all constants live in `packages/contracts/limits.ts`, env-overridable on the server)

| Item | Limit |
|---|---|
| Raw request body | 128 KB (enforced on the stream before parsing) |
| Events per batch | 50 (SDK default 20) |
| Single event serialized | 8 KB |
| `eventId` | UUIDv7 or ULID, validated by format |
| Event name | `^[A-Za-z][A-Za-z0-9_.:-]{0,63}$`; reserved prefix `$` |
| Properties | flat object only, ≤ 20 keys, **no nesting** |
| Property key | `^[A-Za-z][A-Za-z0-9_]{0,63}$` |
| Property value | string ≤ 255 chars, finite number within safe-integer range, boolean, or null |
| URL / referrer | ≤ 2048 chars, must parse as http(s) |
| `title` | ≤ 300 chars |
| `userId` / `anonymousId` | ≤ 128 chars |
| Reserved properties | `$revenue`: finite number, absolute value ≤ 1e9, stored with 2 decimals. `$currency`: ISO 4217, uppercase, 3 letters, **required when `$revenue` is present** (otherwise the revenue is dropped and counted). Any other `$`-prefixed key is rejected. |
| Server-key events | Must carry `userId` or `anonymousId`. Origin check skipped. **No IP, UA, or geo enrichment from the request** (the request comes from the operator's server, not the visitor); device/geo fields stay null. They create no visit. |
| Distinct visitors per batch | ≤ 5 for browser keys (server keys exempt) |
| Max event age | 72 h (configurable) |
| Max future skew | 5 min |
| Distinct property keys per (project, event name) | 50. Excess keys are dropped and counted in a metric. |

Unknown top-level and event fields are stripped and counted. An unsupported `schemaVersion` rejects the whole batch.

### 6.3 Clock skew

Client clocks are wrong often. The server computes `offset = server_now − sentAt` and sets `effective_occurred_at = occurredAt + offset`. Then:
- If it is more than 5 min in the future: reject that event, `EVENT_IN_FUTURE`.
- If it is older than the max age: reject that event, `EVENT_TOO_OLD`.

The SDK recomputes `sentAt` on every send attempt, including retries.

### 6.4 Response

- `200` `{ "accepted": n, "duplicates": n, "rejected": [{ "index": 3, "code": "INVALID_EVENT", "path": "properties.plan" }], "requestId": "…" }`.
- Events dropped by bot filter or internal-traffic exclusion are counted as `accepted` in the response. Do not reveal filter rules to callers. Count them in internal metrics.
- `200` means **committed to PostgreSQL**. Nothing is accepted into memory and written later.

### 6.5 Error codes (stable, documented in `docs/api.md`)

| Code | HTTP | SDK retries? |
|---|---|---|
| `INVALID_JSON`, `INVALID_ENVELOPE`, `UNSUPPORTED_SCHEMA_VERSION`, `BATCH_TOO_LARGE`, `TOO_MANY_VISITORS_IN_BATCH` | 400 | No |
| `INVALID_WRITE_KEY`, `WRITE_KEY_REVOKED` | 401 | No |
| `ORIGIN_NOT_ALLOWED` | 403 | No |
| `PAYLOAD_TOO_LARGE` | 413 | No (SDK halves the batch once, then drops) |
| `RATE_LIMITED` | 429 + `Retry-After` | Yes, honoring `Retry-After`, bounded |
| `QUOTA_EXCEEDED` | 429 | No until the next quota window |
| `INTERNAL_ERROR` | 500 | Yes |
| `SERVICE_UNAVAILABLE` | 503 | Yes |
| Network error / timeout / 408 / 502 / 504 | n/a | Yes |

Error body shape everywhere: `{ "error": { "code", "message", "requestId" } }`. No stack traces, SQL errors, or key material in any response.
