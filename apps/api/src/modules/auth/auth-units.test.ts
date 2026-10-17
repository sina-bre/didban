import { hash } from "@node-rs/argon2";
import { describe, expect, it } from "vitest";
import { truncateIp, uaLabel } from "./client-meta.js";
import { LoginLimiter } from "./login-limiter.js";
import { ARGON2_PARAMS, hashPassword, needsRehash, verifyPassword } from "./password-hasher.js";
import { checkPassword } from "./password-policy.js";
import { readCookie } from "./session-cookie.js";
import { hashSessionToken, isWellFormedToken, newSessionToken } from "./session-token.js";

describe("password policy (spec §11)", () => {
  it("enforces 12–128 code points and the common list, with no composition rules", () => {
    expect(checkPassword("short-one")).toBe("TOO_SHORT");
    expect(checkPassword("x".repeat(129))).toBe("TOO_LONG");
    expect(checkPassword("Unbelievable")).toBe("TOO_COMMON");
    expect(checkPassword("correct horse battery")).toBeNull();
    expect(checkPassword("رمز عبور خیلی خوب")).toBeNull(); // 17 code points, Persian
  });
});

describe("password hasher", () => {
  it("hashes with Argon2id at the configured parameters and verifies", async () => {
    const stored = await hashPassword("correct horse battery");
    expect(stored).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(await verifyPassword(stored, "correct horse battery")).toBe(true);
    expect(await verifyPassword(stored, "wrong horse battery")).toBe(false);
    expect(await verifyPassword("not-a-hash", "x")).toBe(false);
    expect(needsRehash(stored)).toBe(false);
  });

  it("flags weaker hashes for rehash", async () => {
    const weak = await hash("pw", { ...ARGON2_PARAMS, memoryCost: 8192 });
    expect(needsRehash(weak)).toBe(true);
  });
});

describe("session token", () => {
  it("is 256-bit base64url and hashes to 32 bytes", () => {
    const token = newSessionToken();
    expect(isWellFormedToken(token)).toBe(true);
    expect(isWellFormedToken(`${token}x`)).toBe(false);
    expect(isWellFormedToken(undefined)).toBe(false);
    expect(hashSessionToken(token)).toHaveLength(32);
    expect(newSessionToken()).not.toBe(token);
  });
});

describe("client meta", () => {
  it("truncates IPs and reduces the UA to a coarse label", () => {
    expect(truncateIp("203.0.113.77")).toBe("203.0.113.0/24");
    expect(truncateIp("::ffff:198.51.100.9")).toBe("198.51.100.0/24");
    expect(truncateIp("2001:db8:abcd:12::1")).toBe("2001:db8:abcd::/48");
    expect(truncateIp("::1")).toBe("0:0:0::/48");
    const firefox =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0";
    expect(uaLabel(firefox)).toBe("Firefox on Windows");
    expect(uaLabel(undefined)).toBe("Unknown");
  });

  it("reads one cookie from the header", () => {
    expect(readCookie("a=1; sid=abc; b=2", "sid")).toBe("abc");
    expect(readCookie("xsid=abc", "sid")).toBeUndefined();
    expect(readCookie(undefined, "sid")).toBeUndefined();
  });
});

describe("login limiter", () => {
  const clock = () => {
    let t = 1_000_000;
    return { now: () => t, advance: (ms: number) => (t += ms) };
  };

  it("blocks an (IP, account) pair after 5 failures for the rest of the window", () => {
    const time = clock();
    const limiter = new LoginLimiter(time.now);
    for (let i = 0; i < 5; i += 1) limiter.recordFailure("1.1.1.1", "a@x.io");
    expect(limiter.retryAfter("1.1.1.1", "a@x.io")).toBeGreaterThan(60);
    expect(limiter.retryAfter("2.2.2.2", "b@x.io")).toBe(0);
    time.advance(15 * 60 * 1000);
    expect(limiter.retryAfter("1.1.1.1", "a@x.io")).toBe(0);
  });

  it("delays an account progressively across IPs, never more than 60 s", () => {
    const time = clock();
    const limiter = new LoginLimiter(time.now);
    for (let i = 0; i < 5; i += 1) limiter.recordFailure(`10.0.0.${i}`, "a@x.io");
    expect(limiter.retryAfter("10.0.1.1", "a@x.io")).toBe(1);
    for (let i = 0; i < 10; i += 1) limiter.recordFailure(`10.0.2.${i}`, "a@x.io");
    expect(limiter.retryAfter("10.0.1.1", "a@x.io")).toBe(60);
    time.advance(60_000);
    expect(limiter.retryAfter("10.0.1.1", "a@x.io")).toBe(0);
  });

  it("blocks an IP after 30 failures across accounts; success clears the account", () => {
    const limiter = new LoginLimiter(clock().now);
    for (let i = 0; i < 30; i += 1) limiter.recordFailure("9.9.9.9", `u${i}@x.io`);
    expect(limiter.retryAfter("9.9.9.9", "new@x.io")).toBeGreaterThan(0);
    limiter.recordSuccess("9.9.9.9", "u1@x.io");
    expect(limiter.retryAfter("8.8.8.8", "u1@x.io")).toBe(0);
  });
});
