import { describe, expect, it } from "vitest";
import { toEventUuid } from "./event-id.js";
import { uuidV7 } from "./uuid-v7.js";
import { anonymousVisitorId, cookielessVisitorId, userVisitorId } from "./visitor-id.js";

// Spec §4 identity hashes and §6.2 event IDs, pure.

const P1 = "0192f3a0-0000-7000-8000-000000000001";
const P2 = "0192f3a0-0000-7000-8000-000000000002";
const salt = Buffer.alloc(32, 1);
const client = { ip: "203.0.113.7", userAgent: "Mozilla/5.0 Test" };

describe("visitor IDs", () => {
  it("are 16 bytes, stable for equal input, and differ per project, salt and kind", () => {
    const id = cookielessVisitorId(salt, P1, client);
    expect(id).toHaveLength(16);
    expect(cookielessVisitorId(salt, P1, { ...client, userAgent: " mozilla/5.0 test " })).toEqual(
      id,
    );
    expect(cookielessVisitorId(salt, P2, client)).not.toEqual(id);
    expect(cookielessVisitorId(Buffer.alloc(32, 2), P1, client)).not.toEqual(id);
    expect(anonymousVisitorId(P1, "x")).not.toEqual(userVisitorId(P1, "x"));
    expect(anonymousVisitorId(P1, "x")).not.toEqual(anonymousVisitorId(P2, "x"));
  });

  it("cannot collide by moving characters between fields", () => {
    const a = cookielessVisitorId(salt, P1, { ip: "1.2.3.4", userAgent: "5x" });
    const b = cookielessVisitorId(salt, P1, { ip: "1.2.3.45", userAgent: "x" });
    expect(a).not.toEqual(b);
  });
});

describe("event IDs", () => {
  it("maps a ULID to the UUID with the same 128 bits and lowercases UUIDs", () => {
    expect(toEventUuid("00000000000000000000000001")).toBe("00000000-0000-0000-0000-000000000001");
    expect(toEventUuid("7ZZZZZZZZZZZZZZZZZZZZZZZZZ")).toBe("ffffffff-ffff-ffff-ffff-ffffffffffff");
    expect(toEventUuid("0192F3A0-7B1C-7C3E-9F10-2A4D5E6F7A81")).toBe(
      "0192f3a0-7b1c-7c3e-9f10-2a4d5e6f7a81",
    );
  });

  it("generates time-ordered UUIDv7 values", () => {
    const id = uuidV7(Date.UTC(2026, 9, 18));
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(uuidV7(1) < uuidV7(2)).toBe(true);
  });
});
