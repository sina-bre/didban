import { isIPv4 } from "node:net";

// Spec §11: sessions keep a coarse UA label and a truncated IP, never the raw values.

/** IPv4 → /24, IPv6 → /48. Shown in "active sessions"; not enough to identify a person. */
export function truncateIp(ip: string): string {
  const plain = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  if (isIPv4(plain)) return `${plain.split(".").slice(0, 3).join(".")}.0/24`;
  // Groups before any "::" are the leading ones ("::1" has none); missing groups are zero.
  const groups = (plain.split("::")[0] ?? "").split(":").filter(Boolean).slice(0, 3);
  while (groups.length < 3) groups.push("0");
  return `${groups.join(":")}::/48`;
}

const BROWSERS: [RegExp, string][] = [
  [/Edg\//, "Edge"],
  [/OPR\//, "Opera"],
  [/Firefox\//, "Firefox"],
  [/Chrome\//, "Chrome"],
  [/Safari\//, "Safari"],
];
const SYSTEMS: [RegExp, string][] = [
  [/Android/, "Android"],
  [/iPhone|iPad/, "iOS"],
  [/Windows/, "Windows"],
  [/Mac OS X/, "macOS"],
  [/Linux/, "Linux"],
];

const match = (ua: string, table: [RegExp, string][]) =>
  table.find(([pattern]) => pattern.test(ua))?.[1] ?? "Other";

/** "Firefox on Windows". Coarse on purpose; the full parser arrives with ingestion (ADR 0001). */
export function uaLabel(userAgent: string | undefined): string {
  if (!userAgent) return "Unknown";
  return `${match(userAgent, BROWSERS)} on ${match(userAgent, SYSTEMS)}`;
}
