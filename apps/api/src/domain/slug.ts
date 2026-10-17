// URL slugs for organizations and projects (`^[a-z0-9]+(-[a-z0-9]+)*$`, ≤ 60 chars in the DB).

/** "Acme Analytics GmbH" → "acme-analytics-gmbh". Names with no Latin letters give `fallback`. */
export function slugify(name: string, fallback: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "") // drop accents split off by NFKD
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/, "");
  return slug || fallback;
}

/** "acme", then "acme-2", "acme-3"... given the slugs already taken. */
export function nextFreeSlug(base: string, taken: ReadonlySet<string>): string {
  let slug = base;
  for (let n = 2; taken.has(slug); n += 1) slug = `${base}-${n}`;
  return slug;
}
