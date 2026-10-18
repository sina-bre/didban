import { describe, expect, it } from "vitest";
import { looksLikePii } from "./pii.js";
import { matchRoute, parseRouteTemplate, type RouteTemplate } from "./route-template.js";
import { sanitizeUrl, type UrlRules } from "./sanitize-url.js";

const templates = (...patterns: string[]) =>
  patterns.map((pattern) => parseRouteTemplate(pattern) as RouteTemplate);

describe("route templates (spec §7 step 6)", () => {
  it("parses literals, :params and a trailing *", () => {
    expect(parseRouteTemplate("/products/:id")).toEqual({
      pattern: "/products/:id",
      segments: ["products", ":id"],
      rest: false,
    });
    expect(parseRouteTemplate("/blog/*")?.rest).toBe(true);
    expect(parseRouteTemplate("/")).toEqual({ pattern: "/", segments: [], rest: false });
  });

  it("refuses regex syntax, * in the middle, and missing leading slash", () => {
    for (const bad of ["/(a+)+$", "/a/*/b", "products/:id", "/a/:1x", "/a//b", "/a b", "/[x]"]) {
      expect(parseRouteTemplate(bad), bad).toBeNull();
    }
    expect(parseRouteTemplate(`/${"a".repeat(200)}`)).toBeNull();
  });

  it("matches by position: first match wins, else the pathname itself", () => {
    const list = templates("/products/new", "/products/:id", "/blog/*");
    expect(matchRoute(list, "/products/new")).toBe("/products/new");
    expect(matchRoute(list, "/products/42")).toBe("/products/:id");
    expect(matchRoute(list, "/products/42/reviews")).toBe("/products/42/reviews");
    expect(matchRoute(list, "/blog")).toBe("/blog/*");
    expect(matchRoute(list, "/blog/2026/10/post")).toBe("/blog/*");
    expect(matchRoute(list, "/pricing")).toBe("/pricing");
    expect(matchRoute(templates("/"), "/")).toBe("/");
    expect(matchRoute(templates("/#/users/:id"), "/#/users/7")).toBe("/#/users/:id");
  });

  it("stays linear on hostile input (no regex backtracking)", () => {
    const list = templates(...Array.from({ length: 200 }, (_, i) => `/a/:x/b${i}/*`));
    const path = `/${"a/".repeat(5000)}`;
    const started = performance.now();
    expect(matchRoute(list, path)).toBe(path);
    expect(performance.now() - started).toBeLessThan(200);
  });
});

describe("PII guard (spec §7 step 6)", () => {
  it("flags emails and Luhn-valid card numbers, with spaces or dashes", () => {
    expect(looksLikePii("jane.doe+news@example.co.uk")).toBe(true);
    expect(looksLikePii("contact me at a@b.io please")).toBe(true);
    expect(looksLikePii("4111111111111111")).toBe(true);
    expect(looksLikePii("4111 1111 1111 1111")).toBe(true);
    expect(looksLikePii("5500-0000-0000-0004")).toBe(true);
  });

  it("leaves ordinary values alone", () => {
    expect(looksLikePii("4111111111111112")).toBe(false); // fails Luhn
    expect(looksLikePii("123456789012")).toBe(false); // 12 digits
    expect(looksLikePii("@handle")).toBe(false);
    expect(looksLikePii("pro")).toBe(false);
    expect(looksLikePii("order-2026-10-18")).toBe(false);
  });
});

describe("URL sanitization (spec §7 step 6)", () => {
  const rules: UrlRules = { hashRouting: false, trailingSlash: "strip", keepParams: ["plan"] };

  it("lowercases the host, drops the hash and every non-kept query parameter", () => {
    const url = sanitizeUrl(
      "https://App.Example.COM/Pricing/?utm_source=News&token=s3cret&plan=pro&ref=hn&x=1#top",
      rules,
    );
    expect(url).toEqual({
      hostname: "app.example.com",
      pathname: "/Pricing",
      query: { utm_source: "News", plan: "pro", ref: "hn" },
    });
  });

  it("keeps the first value only and skips empty values", () => {
    const url = sanitizeUrl("https://a.com/?utm_medium=&utm_medium=cpc&plan=a&plan=b", rules);
    expect(url?.query).toEqual({ utm_medium: "cpc", plan: "a" });
  });

  it("applies trailing-slash policy and hash routing", () => {
    expect(sanitizeUrl("https://a.com/", rules)?.pathname).toBe("/");
    expect(sanitizeUrl("https://a.com/docs//", rules)?.pathname).toBe("/docs");
    const keep = { ...rules, trailingSlash: "keep" as const };
    expect(sanitizeUrl("https://a.com/docs/", keep)?.pathname).toBe("/docs/");
    const hash = { ...rules, hashRouting: true };
    expect(sanitizeUrl("https://a.com/app#/settings?tab=2", hash)?.pathname).toBe("/app#/settings");
  });

  it("caps lengths and refuses non-http URLs", () => {
    const long = sanitizeUrl(`https://a.com/${"p".repeat(1500)}?plan=${"v".repeat(400)}`, rules);
    expect(long?.pathname).toHaveLength(1024);
    expect(long?.query.plan).toHaveLength(255);
    expect(sanitizeUrl("javascript:alert(1)", rules)).toBeNull();
    expect(sanitizeUrl("not a url", rules)).toBeNull();
  });
});
