import { readFileSync } from "node:fs";

// Spec §7 step 6 "Referrer": reduce to the host and map it to a source via data/sources.json.
// Only the host is kept (events have no referrer-path column). Self-referrals (the page's own host
// or a host of the environment's allowed origins) count as no referrer (spec §4).

export type SourceType = "search" | "social" | "email" | "referral";
export type Referrer = { host: string; source: string | null; type: SourceType | null };

type SourceEntry = { name: string; type: SourceType; domains: string[] };
const FILE = new URL("../../../../data/sources.json", import.meta.url);
const MAX_HOST_LENGTH = 253;

const exact = new Map<string, SourceEntry>();
const wildcard = new Map<string, SourceEntry>();
for (const entry of (JSON.parse(readFileSync(FILE, "utf8")) as { sources: SourceEntry[] })
  .sources) {
  for (const domain of entry.domains) {
    if (domain.endsWith(".*")) wildcard.set(domain.slice(0, -2), entry);
    else exact.set(domain, entry);
  }
}

function findSource(host: string): SourceEntry | null {
  const labels = host.split(".");
  for (let i = 0; i < labels.length - 1; i++) {
    const found = exact.get(labels.slice(i).join("."));
    if (found) return found;
  }
  // "google.*": the label followed only by short TLD-like labels (google.com, google.co.uk).
  for (let i = 0; i < labels.length - 1; i++) {
    const found = wildcard.get(labels[i] ?? "");
    if (found && labels.slice(i + 1).every((label) => label.length <= 3)) return found;
  }
  return null;
}

/** `null` = no referrer (missing, unparseable, not http(s), or a self-referral). */
export function readReferrer(
  raw: string | undefined,
  ownHosts: readonly string[],
): Referrer | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const host = url.hostname.replace(/^www\./, "").slice(0, MAX_HOST_LENGTH);
  const own = ownHosts.some((own) => own.replace(/^www\./, "") === host);
  if (own || host === "") return null;
  const source = findSource(host);
  return { host, source: source?.name ?? null, type: source?.type ?? null };
}
