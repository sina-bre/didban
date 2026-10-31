import {
  SHARE_TOKEN_HEADER,
  SHARE_TOKEN_PATTERN,
  type SharedProjectResponse,
} from "@didban/contracts";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../../shared/lib/api-client";
import type { StatsSource } from "../report/stats-source";

const STORE = "didban.share";

/**
 * The token from the URL fragment (`/share#dsh_…`, ADR 0036). Filter and range links replace the
 * fragment, so it is kept in this tab's sessionStorage too: a reload still works, nothing is sent
 * to a server except the `X-Share-Token` header.
 */
function readToken(): string | null {
  const fromHash = window.location.hash.slice(1);
  if (SHARE_TOKEN_PATTERN.test(fromHash)) {
    sessionStorage.setItem(STORE, fromHash);
    return fromHash;
  }
  const stored = sessionStorage.getItem(STORE);
  return stored && SHARE_TOKEN_PATTERN.test(stored) ? stored : null;
}

/** `GET /share` (project name, label, zone) and the stats source the report components use. */
export function useSharedProject() {
  const [token] = useState(readToken);
  const headers = { [SHARE_TOKEN_HEADER]: token ?? "" };
  const info = useQuery({
    queryKey: ["share", token],
    queryFn: ({ signal }) => api<SharedProjectResponse>("/share", { headers, signal }),
    enabled: token !== null,
    retry: false,
  });
  const source: StatsSource | null = info.data
    ? {
        key: `share:${token}`,
        path: (report) => `/share/stats/${report}`,
        headers,
        timeZone: info.data.timezone,
      }
    : null;
  return { token, info, source };
}
