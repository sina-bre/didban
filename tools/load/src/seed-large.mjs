// `pnpm -C tools/load seed:large [visits]` (Stage 4d): a large, realistic-shaped dataset on the
// LOCAL TEST DB for query plans. Pure SQL (generate_series, PostgreSQL 18 uuidv7), chunks of
// 100 000 visits; ~4.7 events per visit, 90 days, ~37 % returning visitors, 1 % server
// purchases with revenue. Deterministic (setseed). The next `pnpm test` truncates it.
import postgres from "postgres";
import { localDatabaseUrl } from "./environment.mjs";

const visits = Number(process.argv[2] ?? 2_350_000);
const resume = process.argv[3]; // project ID of an interrupted run: continue after its visits
const CHUNK = 100_000;
const sql = postgres(localDatabaseUrl("TEST_DATABASE_URL"), { max: 1, onnotice: () => {} });
// Bulk statements run longer than the app role's statement_timeout (spec §9.5): lifted per
// transaction (SET LOCAL), because postgres.js replaces connections after 30–60 min.
const long = (run) =>
  sql.begin(async (tx) => {
    await tx`SET LOCAL statement_timeout = 0`;
    return run(tx);
  });
const migrator = postgres(localDatabaseUrl("TEST_MIGRATION_DATABASE_URL"), {
  max: 1,
  onnotice: () => {},
});

async function target() {
  if (resume) {
    const [row] = await sql`SELECT id FROM environments WHERE project_id = ${resume}`;
    const [done] = await sql`SELECT count(*)::int AS n FROM visits WHERE project_id = ${resume}`;
    return { p: resume, e: row.id, start: done.n };
  }
  const slug = `perf-${Date.now()}`;
  const [org] =
    await sql`INSERT INTO organizations (name, slug) VALUES (${slug}, ${slug}) RETURNING id`;
  const [project] = await sql`
    INSERT INTO projects (organization_id, name, slug, reporting_timezone)
    VALUES (${org.id}, ${slug}, ${slug}, 'Europe/Berlin') RETURNING id`;
  const [env] = await sql`
    INSERT INTO environments (project_id, name) VALUES (${project.id}, 'production') RETURNING id`;
  return { p: project.id, e: env.id, start: 0 };
}
const ids = await target();

function chunk(from, to) {
  return long(async (tx) => {
    await tx`SELECT setseed(${(from % 1000) / 1000})`;
    await tx`
    WITH v AS (
      INSERT INTO visits (project_id, visit_id, environment_id, visitor_id, started_at, last_seen_at,
        entry_pathname, exit_pathname, pageviews, events, channel, referrer_source, utm_source,
        country, browser, os, device_type)
      SELECT ${ids.p}::uuid, uuidv7(s.started - now()), ${ids.e}::uuid,
        decode(md5('v' || (n * 0.63)::int), 'hex'), s.started, s.started + (s.pv + s.tr - 1) * interval '30 s',
        '/page/' || (n * 7 % 200), '/page/' || ((n * 7 + (s.pv - 1) * 13) % 200), s.pv, s.pv + s.tr,
        s.ch, CASE s.ch WHEN 1 THEN 'Google' WHEN 3 THEN 'Twitter' WHEN 5 THEN 'example.org' END,
        CASE WHEN s.ch = 4 THEN 'newsletter' END,
        (ARRAY['DE','US','FR','IR','GB','NL','IN','BR',NULL])[1 + n % 9],
        (ARRAY['Chrome','Safari','Firefox','Edge'])[1 + n % 4],
        (ARRAY['Windows','macOS','iOS','Android','Linux'])[1 + n % 5], 1 + n % 3
      FROM generate_series(${from}::int, ${to - 1}::int) AS n,
      LATERAL (SELECT now() - random() * interval '90 days' AS started,
                      1 + floor(random() ^ 2 * 8)::int AS pv, floor(random() * 3)::int AS tr,
                      (n % 6) AS ch) AS s
      RETURNING *
    )
    INSERT INTO events (project_id, environment_id, event_id, type, occurred_at, received_at,
      visitor_id, source, visit_id, name, hostname, pathname, route, channel, referrer_source,
      utm_source, country, browser, os, device_type, screen_class, language, properties)
    SELECT v.project_id, v.environment_id, uuidv7(t.at - now()), t.type, t.at, t.at, v.visitor_id, 1,
      v.visit_id, t.name, 'shop.example', t.path, t.path, v.channel, v.referrer_source, v.utm_source,
      v.country, v.browser, v.os, v.device_type, 1 + v.device_type, 'en-US', t.props
    FROM v, generate_series(1, v.events) AS i,
    LATERAL (SELECT v.started_at + (i - 1) * interval '30 s' AS at,
                    CASE WHEN i <= v.pageviews THEN 1 ELSE 2 END AS type,
                    CASE WHEN i > v.pageviews THEN (ARRAY['signup','scroll_depth','engaged_time'])[1 + i % 3] END AS name,
                    '/page/' || (abs(hashtext(v.visit_id::text || i::text)) % 200) AS path,
                    CASE WHEN i > v.pageviews THEN jsonb_build_object('plan', 'pro', 'percent', 25 * (1 + i % 4))
                         ELSE '{}'::jsonb END AS props) AS t`;
  });
}

const started = performance.now();
for (let from = ids.start; from < visits; from += CHUNK) {
  await chunk(from, Math.min(from + CHUNK, visits));
  process.stdout.write(`\rvisits ${Math.min(from + CHUNK, visits)} / ${visits}`);
}
await long(
  (tx) => tx`
  INSERT INTO events (project_id, environment_id, event_id, type, occurred_at, received_at, visitor_id,
    source, name, hostname, pathname, route, channel, revenue, currency)
  SELECT ${ids.p}, ${ids.e}, uuidv7(-(n % 90) * interval '1 day'), 2, now() - (n % 90) * interval '1 day',
    now(), decode(md5('s' || n), 'hex'), 2, 'purchase', 'shop.example', '/checkout', '/checkout', 0,
    (n % 500) + 0.99, (ARRAY['EUR','USD'])[1 + n % 2]
  FROM generate_series(1, ${Math.round(visits * 0.05)}::int) AS n`,
);
await sql`
  INSERT INTO pages_seen (project_id, environment_id, hostname, route, first_seen_at, last_seen_at)
  SELECT ${ids.p}, ${ids.e}, 'shop.example', '/page/' || k, now() - interval '90 days', now()
  FROM generate_series(0, 199) AS k`;
await sql`INSERT INTO goals (project_id, name, kind, event_name) VALUES (${ids.p}, 'Signup', 'event', 'signup')`;
await sql`INSERT INTO goals (project_id, name, kind, path_pattern) VALUES (${ids.p}, 'Page 7', 'page', '/page/7')`;
await migrator`ANALYZE events`;
await migrator`ANALYZE visits`;
const [n] = await long(
  (tx) => tx`SELECT (SELECT count(*) FROM events WHERE project_id = ${ids.p})::int8 AS events,
    (SELECT count(*) FROM visits WHERE project_id = ${ids.p})::int8 AS visits`,
);
console.log(
  `\nproject ${ids.p}: ${n.events} events, ${n.visits} visits in ${((performance.now() - started) / 1000).toFixed(0)} s`,
);
await sql.end();
await migrator.end();
