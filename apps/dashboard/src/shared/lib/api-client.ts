import type { ErrorBody } from "@didban/contracts";
import { loginHref } from "./return-path";

// Spec §13.4: the one API module. Same-origin `/api/v1` (ADR 0021), cancellable through an
// AbortSignal, every failure normalized to the contract error shape, and a 401 sends the browser
// to /login with the return path: a full page load, so no cached data outlives the session.
const BASE = "/api/v1";

type ErrorFields = ErrorBody["error"];

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId: string | undefined;

  constructor(status: number, fields: Omit<ErrorFields, "requestId"> & { requestId?: string }) {
    super(fields.message);
    this.name = "ApiError";
    this.status = status;
    this.code = fields.code;
    this.requestId = fields.requestId;
  }
}

export type Query = Record<string, string | readonly string[] | undefined>;

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Sent as JSON (the API's CSRF rule requires the content type, spec §11). */
  body?: unknown;
  query?: Query;
  signal?: AbortSignal;
}

/** The one 401 that is an answer (wrong password at login or password change), not a lost session. */
const ANSWER_401 = "INVALID_CREDENTIALS";

/** What a lost session does: a full load of /login, so no cached data survives it. */
export const session = {
  expired: () => window.location.assign(loginHref(window.location)),
};

/** `/api/v1<path>?<query>`; repeated keys for arrays (`filter=…&filter=…`). Also download links. */
export function apiUrl(path: string, query: Query = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    for (const item of [value ?? []].flat()) params.append(key, item);
  }
  const search = params.toString();
  return `${BASE}${path}${search ? `?${search}` : ""}`;
}

function isErrorBody(value: unknown): value is ErrorBody {
  const fields = (value as { error?: Partial<ErrorFields> } | null)?.error;
  return typeof fields?.code === "string" && typeof fields.message === "string";
}

/** The contract body when the API sent one; otherwise `HTTP_<status>` (a proxy, a crash). */
async function errorOf(response: Response): Promise<ApiError> {
  const requestId = response.headers.get("x-request-id") ?? undefined;
  const body: unknown = await response.json().catch(() => null);
  if (isErrorBody(body)) {
    return new ApiError(response.status, {
      ...body.error,
      requestId: body.error.requestId ?? requestId,
    });
  }
  const code = `HTTP_${response.status}`;
  return new ApiError(response.status, { code, message: response.statusText || code, requestId });
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, query, signal } = options;
  const headers: Record<string, string> = { accept: "application/json" };
  if (body !== undefined) headers["content-type"] = "application/json";
  let response: Response;
  try {
    response = await fetch(apiUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error; // cancellation stays an AbortError for TanStack Query
    throw new ApiError(0, { code: "NETWORK_ERROR", message: "Network request failed" });
  }
  if (response.ok) return (response.status === 204 ? undefined : await response.json()) as T;
  const error = await errorOf(response);
  if (response.status === 401 && error.code !== ANSWER_401) session.expired();
  throw error;
}
