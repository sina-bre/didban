import { describe, expect, it } from "vitest";
import { InvalidEnvError, loadEnv } from "./env.js";

const base = {
  PUBLIC_ORIGIN: "http://localhost:5173",
  DATABASE_URL: "postgresql://app:pw@localhost:5432/didban_dev",
  SESSION_COOKIE: "insecure-dev",
};

describe("loadEnv", () => {
  it("applies defaults for development", () => {
    const env = loadEnv(base);
    expect(env).toMatchObject({ NODE_ENV: "development", PORT: 3000, INSTANCE_ROLE: "all" });
    expect(env.TRUST_PROXY).toBe(0);
  });

  it("fails fast and names every bad variable", () => {
    expect(() => loadEnv({ PORT: "abc", INSTANCE_ROLE: "both" })).toThrow(InvalidEnvError);
    try {
      loadEnv({ PORT: "abc" });
    } catch (error) {
      expect((error as Error).message).toMatch(/PUBLIC_ORIGIN/);
      expect((error as Error).message).toMatch(/PORT/);
    }
  });

  it("parses trusted proxies as hop count or CIDR list", () => {
    expect(loadEnv({ ...base, TRUST_PROXY: "1" }).TRUST_PROXY).toBe(1);
    expect(loadEnv({ ...base, TRUST_PROXY: "10.0.0.0/8, ::1" }).TRUST_PROXY).toEqual([
      "10.0.0.0/8",
      "::1",
    ]);
    expect(() => loadEnv({ ...base, TRUST_PROXY: "everyone" })).toThrow(InvalidEnvError);
  });

  it("refuses http or IP origins in production (spec §14.0)", () => {
    const prod = { NODE_ENV: "production", DATABASE_URL: base.DATABASE_URL };
    expect(() => loadEnv({ ...prod, PUBLIC_ORIGIN: "http://analytics.example.com" })).toThrow();
    expect(() => loadEnv({ ...prod, PUBLIC_ORIGIN: "https://203.0.113.7" })).toThrow();
    expect(() => loadEnv({ ...prod, PUBLIC_ORIGIN: "https://[::1]" })).toThrow();
    expect(loadEnv({ ...prod, PUBLIC_ORIGIN: "https://analytics.example.com" }).NODE_ENV).toBe(
      "production",
    );
  });

  it("needs an explicit insecure-dev cookie switch for http and refuses it in production", () => {
    expect(() => loadEnv({ ...base, SESSION_COOKIE: undefined })).toThrow(/SESSION_COOKIE/);
    const prod = { ...base, NODE_ENV: "production", PUBLIC_ORIGIN: "https://a.example.com" };
    expect(() => loadEnv(prod)).toThrow(/SESSION_COOKIE/);
    expect(loadEnv({ ...prod, SESSION_COOKIE: "secure" }).SESSION_COOKIE).toBe("secure");
  });
});
