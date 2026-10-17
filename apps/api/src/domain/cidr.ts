import { isIP } from "node:net";

/**
 * Internal-traffic exclusions (spec §7 step 6). "10.0.0.0/8" stays as is, a bare address gets
 * its full-length prefix ("203.0.113.7" → "203.0.113.7/32"). `null` when it is not a CIDR.
 */
export function normalizeCidr(value: string): string | null {
  const [address = "", prefix, extra] = value.trim().toLowerCase().split("/");
  const version = isIP(address);
  if (version === 0 || extra !== undefined) return null;
  const max = version === 4 ? 32 : 128;
  if (prefix === undefined) return `${address}/${max}`;
  if (!/^\d{1,3}$/.test(prefix) || Number(prefix) > max) return null;
  return `${address}/${Number(prefix)}`;
}

/** All normalized, deduplicated; or `null` if any entry is invalid. */
export function normalizeCidrs(values: readonly string[]): string[] | null {
  const out = new Set<string>();
  for (const value of values) {
    const cidr = normalizeCidr(value);
    if (!cidr) return null;
    out.add(cidr);
  }
  return [...out];
}
