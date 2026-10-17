import { describe, expect, it } from "vitest";
import { loginRequestSchema, PASSWORD_LIMITS } from "../src/auth.js";

describe("loginRequestSchema", () => {
  it("normalizes the email to trimmed lower case", () => {
    const parsed = loginRequestSchema.parse({ email: "  Owner@Example.COM ", password: "x" });
    expect(parsed.email).toBe("owner@example.com");
  });

  it("rejects a bad email, an empty password and an over-long password", () => {
    const long = "a".repeat(PASSWORD_LIMITS.max + 1);
    expect(loginRequestSchema.safeParse({ email: "nope", password: "x" }).success).toBe(false);
    expect(loginRequestSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
    expect(loginRequestSchema.safeParse({ email: "a@b.co", password: long }).success).toBe(false);
  });
});
