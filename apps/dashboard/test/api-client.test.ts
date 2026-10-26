import { afterEach, describe, expect, it, vi } from "vitest";
import { retryable } from "../src/app/query-client";
import { ApiError, api } from "../src/shared/lib/api-client";
import { HOME, loginHref, safeNext } from "../src/shared/lib/return-path";

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });

function stubFetch(response: Response | { throws: unknown }) {
  const fetch = vi.fn(async () => {
    if ("throws" in response) throw response.throws;
    return response;
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

afterEach(() => vi.unstubAllGlobals());

describe("api", () => {
  it("sends JSON with the content type, the query and the signal, same-origin", async () => {
    const fetch = stubFetch(json(200, { ok: true }));
    const signal = new AbortController().signal;
    const body = { email: "a@example.com" };
    await api("/auth/login", { method: "POST", body, query: { filter: ["a", "b"] }, signal });
    expect(fetch).toHaveBeenCalledWith("/api/v1/auth/login?filter=a&filter=b", {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify(body),
      credentials: "same-origin",
      signal,
    });
  });

  it("returns undefined for 204", async () => {
    stubFetch(new Response(null, { status: 204 }));
    await expect(api("/auth/logout", { method: "POST" })).resolves.toBeUndefined();
  });

  it("normalizes the contract error body", async () => {
    const error = { code: "NOT_FOUND", message: "Not found", requestId: "r-1" };
    stubFetch(json(404, { error }));
    await expect(api("/projects/x")).rejects.toMatchObject({ status: 404, ...error });
  });

  it("normalizes a body that is not the contract shape, request id from the header", async () => {
    stubFetch(
      new Response("<html>bad gateway</html>", { status: 502, headers: { "x-request-id": "r-2" } }),
    );
    const error = await api("/projects").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 502, code: "HTTP_502", requestId: "r-2" });
  });

  it("turns a failed fetch into NETWORK_ERROR but keeps an abort as an abort", async () => {
    stubFetch({ throws: new TypeError("Failed to fetch") });
    await expect(api("/projects")).rejects.toMatchObject({ status: 0, code: "NETWORK_ERROR" });
    const controller = new AbortController();
    controller.abort();
    stubFetch({ throws: new DOMException("aborted", "AbortError") });
    await expect(api("/projects", { signal: controller.signal })).rejects.toMatchObject({
      name: "AbortError",
    });
  });

  it("a 401 answer without the redirect (the login form) is just an error", async () => {
    const error = { code: "INVALID_CREDENTIALS", message: "no", requestId: "r" };
    stubFetch(json(401, { error }));
    await expect(api("/auth/login", { authRedirect: false })).rejects.toMatchObject({
      status: 401,
    });
  });
});

describe("return path", () => {
  it("login keeps the current path and search, never an auth page", () => {
    expect(loginHref({ pathname: "/projects/p/overview", search: "?range=7d" })).toBe(
      "/login?next=%2Fprojects%2Fp%2Foverview%3Frange%3D7d",
    );
    expect(loginHref({ pathname: "/login", search: "?next=%2Fx" })).toBe("/login");
    expect(loginHref({ pathname: "/set-password", search: "" })).toBe("/login");
  });

  it("next stays on this origin (no open redirect)", () => {
    const origin = "http://127.0.0.1:5173";
    expect(safeNext("/projects/p/overview?range=7d", origin)).toBe("/projects/p/overview?range=7d");
    for (const bad of [null, "", "https://evil.example/", "//evil.example/x", "/\\evil.example"]) {
      expect(safeNext(bad, origin)).toBe(HOME);
    }
  });
});

describe("retryable", () => {
  it("retries network errors and 5xx twice, never 4xx", () => {
    const err = (status: number) => new ApiError(status, { code: "X", message: "x" });
    expect(retryable(0, err(0))).toBe(true);
    expect(retryable(1, err(503))).toBe(true);
    expect(retryable(2, err(503))).toBe(false);
    expect(retryable(0, err(404))).toBe(false);
    expect(retryable(0, err(401))).toBe(false);
  });
});
