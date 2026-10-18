import { RequestMethod } from "@nestjs/common";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants.js";
import { DiscoveryService, MetadataScanner, ModulesContainer, Reflector } from "@nestjs/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PERMISSIONS } from "../../domain/permissions.js";
import { startTestApp } from "../../test-support/test-app.js";
import { IS_PUBLIC } from "../auth/public.decorator.js";
import { REQUIRED_PERMISSION } from "./requires.decorator.js";

// Spec §11 route-coverage test: every registered route declares a permission or is on the
// explicit public allowlist. Adding a route without either fails this test (and CI).
const PUBLIC_ALLOWLIST = [
  "GET health/live",
  "GET health/ready",
  "POST auth/login",
  "POST ingest/batch",
  "OPTIONS ingest/batch",
];

type Route = { route: string; isPublic: boolean; permission: unknown };
let routes: Route[] = [];
let close: () => Promise<void>;

beforeAll(async () => {
  const t = await startTestApp();
  close = t.close;
  const reflector = new Reflector();
  const scanner = new MetadataScanner();
  const controllers = new DiscoveryService(t.app.get(ModulesContainer)).getControllers();
  routes = controllers.flatMap(({ metatype, instance }) => {
    const prefix = String(Reflect.getMetadata(PATH_METADATA, metatype as object) ?? "");
    const prototype = Object.getPrototypeOf(instance);
    return scanner.getAllMethodNames(prototype).flatMap((name) => {
      const handler = prototype[name];
      const path = Reflect.getMetadata(PATH_METADATA, handler);
      if (path === undefined) return [];
      const targets = [handler, metatype as object];
      const method = RequestMethod[Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod];
      return [
        {
          route: `${method} ${[prefix, path].filter((p) => p && p !== "/").join("/")}`,
          isPublic: reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets) === true,
          permission: reflector.getAllAndOverride(REQUIRED_PERMISSION, targets),
        },
      ];
    });
  });
});
afterAll(() => close());

describe("route coverage (spec §11)", () => {
  it("finds the routes (guards against a scanner that silently sees nothing)", () => {
    expect(routes.length).toBeGreaterThanOrEqual(32);
  });

  it("public routes are exactly the allowlist", () => {
    const publicRoutes = routes.filter((r) => r.isPublic).map((r) => r.route);
    expect(publicRoutes.sort()).toEqual([...PUBLIC_ALLOWLIST].sort());
  });

  it("every other route declares a known permission", () => {
    const missing = routes.filter(
      (r) => !r.isPublic && !PERMISSIONS.includes(r.permission as never),
    );
    expect(missing.map((r) => r.route)).toEqual([]);
  });
});
