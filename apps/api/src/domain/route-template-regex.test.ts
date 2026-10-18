import { expect, it } from "vitest";
import { findRoute, parseRouteTemplate, templateRegex } from "./route-template.js";

// Page goals match in SQL with the regex; it must agree with the matcher ingestion uses.
const PATTERNS = ["/", "/pricing", "/products/:id", "/blog/*", "/*", "/a.b/:x/*", "/#/settings"];
const PATHS = [
  "/",
  "/pricing",
  "/pricing/",
  "/pricingx",
  "/products/42",
  "/products/42/reviews",
  "/products",
  "/blog",
  "/blog/a/b",
  "/blogx",
  "/a.b/1",
  "/a.b/1/2",
  "/aXb/1",
  "/#/settings",
];

it("templateRegex agrees with findRoute on every sample path", () => {
  for (const pattern of PATTERNS) {
    const template = parseRouteTemplate(pattern);
    if (!template) throw new Error(pattern);
    const regex = new RegExp(templateRegex(template));
    for (const path of PATHS) {
      expect([pattern, path, regex.test(path)]).toEqual([
        pattern,
        path,
        findRoute([template], path) !== null,
      ]);
    }
  }
});
