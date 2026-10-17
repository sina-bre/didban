import { describe, expect, it } from "vitest";
import { createEnvironmentRequestSchema, toOrigin } from "../src/environments.js";
import { isTimeZone, updateProjectRequestSchema } from "../src/projects.js";

describe("isTimeZone", () => {
  it("accepts IANA names and UTC", () => {
    for (const zone of ["UTC", "Europe/Berlin", "Asia/Tehran", "America/Argentina/Salta"]) {
      expect([zone, isTimeZone(zone)]).toEqual([zone, true]);
    }
  });

  it("refuses offsets, abbreviations and unknown names", () => {
    for (const zone of ["+03:30", "EST", "Mars/Olympus", "europe/berlin", ""]) {
      expect([zone, isTimeZone(zone)]).toEqual([zone, false]);
    }
  });
});

describe("toOrigin", () => {
  it("normalizes case, trailing slash and IDN hosts", () => {
    expect(toOrigin("HTTPS://Example.COM/")).toBe("https://example.com");
    expect(toOrigin("http://localhost:5173")).toBe("http://localhost:5173");
    expect(toOrigin("https://bücher.de")).toBe("https://xn--bcher-kva.de");
  });

  it("refuses paths, queries, credentials and other schemes", () => {
    for (const bad of [
      "https://a.com/x",
      "https://a.com?q=1",
      "https://u:p@a.com",
      "ftp://a.com",
      "a.com",
    ]) {
      expect([bad, toOrigin(bad)]).toEqual([bad, null]);
    }
  });
});

describe("request schemas", () => {
  it("dedupes origins after normalizing them", () => {
    const body = createEnvironmentRequestSchema.parse({
      name: "production",
      allowedOrigins: ["https://a.com", "https://A.com/"],
    });
    expect(body.allowedOrigins).toEqual(["https://a.com"]);
  });

  it("refuses an empty project update and out-of-range settings", () => {
    expect(updateProjectRequestSchema.safeParse({}).success).toBe(false);
    expect(updateProjectRequestSchema.safeParse({ sessionTimeoutMinutes: 4 }).success).toBe(false);
    expect(updateProjectRequestSchema.safeParse({ retentionDays: null }).success).toBe(true);
  });
});
