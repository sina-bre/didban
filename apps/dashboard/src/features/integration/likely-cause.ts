import type { DataHealthResponse } from "@didban/contracts";

export interface Cause {
  /** An ingestion code (`ORIGIN_NOT_ALLOWED`, `INTERNAL_TRAFFIC`, ...). */
  code: string;
  /** The rejected Origin, when the rejection had one. */
  origin: string | null;
}

/**
 * Spec §13.4: why no event arrived, from the environment's ingestion diagnostics. The newest
 * rejected batch wins (in memory, immediate); then the most frequent code of the stored counts;
 * then the most frequent rejected origin. `null`: nothing was rejected, so nothing was sent.
 */
export function likelyCause(health: DataHealthResponse): Cause | null {
  const recent = health.recentRejections[0];
  if (recent) return { code: recent.code, origin: recent.origin };
  const top = [...health.rejections].sort((a, b) => b.count - a.count)[0];
  const origin = health.rejectedOrigins[0]?.origin ?? null;
  if (top) return { code: top.code, origin: top.code === "ORIGIN_NOT_ALLOWED" ? origin : null };
  return origin ? { code: "ORIGIN_NOT_ALLOWED", origin } : null;
}
