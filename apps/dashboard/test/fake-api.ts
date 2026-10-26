import { vi } from "vitest";

// Test-only stand-in for the API: `fetch` answers from a table of `METHOD /path` → handler.
// Unknown routes answer 404 in the contract error shape, like the real API.
export type Handler = (url: URL, init: RequestInit) => { status?: number; body?: unknown };
export type Routes = Record<string, Handler | object>;

export interface Call {
  method: string;
  url: URL;
  body: unknown;
}

const respond = (status: number, body: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "x-request-id": "req-test" },
  });

export const apiError = (status: number, code: string) => ({
  status,
  body: { error: { code, message: code, requestId: "req-test" } },
});

export function fakeApi(routes: Routes): Call[] {
  const calls: Call[] = [];
  const fetch = vi.fn(async (input: string, init: RequestInit = {}) => {
    const url = new URL(input, "http://dashboard.test");
    const method = init.method ?? "GET";
    const body = typeof init.body === "string" ? JSON.parse(init.body) : undefined;
    calls.push({ method, url, body });
    const route = routes[`${method} ${url.pathname.replace(/^\/api\/v1/, "")}`];
    if (!route) return respond(404, apiError(404, "NOT_FOUND").body);
    if (typeof route !== "function") return respond(200, route);
    const { status = 200, body: answer } = (route as Handler)(url, init);
    return respond(status, answer);
  });
  vi.stubGlobal("fetch", fetch);
  return calls;
}
