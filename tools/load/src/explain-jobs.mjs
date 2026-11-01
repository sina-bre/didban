// `pnpm -C tools/load explain:jobs` (Stage 6a, ADR 0045): the job runner's statements on the
// large dataset of `seed:large`. Part 1: EXPLAIN (ANALYZE, BUFFERS) of one chunk of each step,
// rolled back. Part 2: the BUILT job functions (apps/api/dist) for real: one user and one visitor
// deletion over the whole span, then retention cutting the oldest 30 days. DESTROYS that data.
import { mkdirSync, writeFileSync } from "node:fs";
import postgres from "postgres";
import { describeEnvironment, localDatabaseUrl } from "./environment.mjs";

const url = localDatabaseUrl("TEST_DATABASE_URL");
// Setup queries scan the whole dataset: no timeout here. The job statements are compared with
// the app role's 15 s statement_timeout in the results instead.
const sql = postgres(url, {
  max: 4,
  transform: postgres.camel,
  onnotice: () => {},
  connection: { statement_timeout: "0" },
});
const jobs = "../../../apps/api/dist/modules/jobs";
const { runDeletions } = await import(`${jobs}/deletion-job.js`);
const { runRetention } = await import(`${jobs}/retention-job.js`);

const [project] = await sql`
  SELECT project_id AS id, min(started_at) AS oldest FROM visits
  GROUP BY project_id ORDER BY count(*) DESC LIMIT 1`;
const [visit] = await sql`
  SELECT visit_id, visitor_id, environment_id, started_at, last_seen_at FROM visits
  WHERE project_id = ${project.id} ORDER BY started_at LIMIT 1 OFFSET 500000`;
const env = visit.environmentId;
await sql`UPDATE events SET user_id = 'explain-user' WHERE project_id = ${project.id}
  AND environment_id = ${env} AND visit_id = ${visit.visitId}
  AND occurred_at BETWEEN ${visit.startedAt} AND ${visit.lastSeenAt}`;
const day = (from) => [from, new Date(from.getTime() + 86_400_000)];
const [a, b] = day(new Date(visit.startedAt.getTime() - 3_600_000));
const cutoff = new Date(project.oldest.getTime() + 30 * 86_400_000);
// As the jobs send them: one environment ($2), one day window ($3, $4), then the match.
const chunk = (
  where,
) => `WITH doomed AS (SELECT event_id FROM events WHERE project_id = $1 AND environment_id = $2
  AND occurred_at >= $3 AND occurred_at < $4 ${where} LIMIT 10000)
  DELETE FROM events e USING doomed d WHERE e.project_id = $1 AND e.event_id = d.event_id
  RETURNING e.visit_id`;
const STATEMENTS = [
  [
    "retention: oldest event of one environment (window start)",
    "SELECT min(occurred_at) FROM events WHERE project_id = $1 AND environment_id = $2",
    [project.id, env],
  ],
  [
    "retention: one events chunk (first day window)",
    chunk(""),
    [project.id, env, ...day(project.oldest)],
  ],
  [
    "retention: one visits chunk (first day window)",
    `WITH doomed AS (SELECT visit_id FROM visits WHERE project_id = $1
    AND started_at >= $2 AND started_at < $3 LIMIT 10000) DELETE FROM visits v USING doomed d
    WHERE v.project_id = $1 AND v.visit_id = d.visit_id`,
    [project.id, ...day(project.oldest)],
  ],
  ["user: one day window", chunk("AND user_id = $5"), [project.id, env, a, b, "explain-user"]],
  [
    "visitor: one day window",
    chunk("AND visitor_id = $5"),
    [project.id, env, a, b, visit.visitorId],
  ],
  [
    "user: rest of one visit",
    `DELETE FROM events WHERE project_id = $1 AND environment_id = $2
    AND occurred_at BETWEEN $3 AND $4 AND visit_id = $5`,
    [project.id, env, visit.startedAt, visit.lastSeenAt, visit.visitId],
  ],
  [
    "visitor: visits",
    `WITH doomed AS (SELECT visit_id FROM visits WHERE project_id = $1
    AND visitor_id = $2 LIMIT 10000) DELETE FROM visits v USING doomed d
    WHERE v.project_id = $1 AND v.visit_id = d.visit_id`,
    [project.id, visit.visitorId],
  ],
];

const out = [
  `# Job statements, ${new Date().toISOString()}`,
  "",
  "```json",
  JSON.stringify(await describeEnvironment(sql), null, 2),
  "```",
];
mkdirSync("results", { recursive: true });
const file = `results/job-plans-${new Date().toISOString().slice(0, 10)}.md`;
/** Written after every step, so a failed statement still leaves the plans before it. */
const save = () => writeFileSync(file, `${out.join("\n")}\n`);
for (const [name, query, params] of STATEMENTS) {
  // The ANALYZE really deletes: the thrown plan rolls the transaction back.
  const plan = await sql
    .begin(async (tx) => {
      const rows = await tx.unsafe(`EXPLAIN (ANALYZE, BUFFERS) ${query}`, params);
      throw { plan: rows.map((row) => Object.values(row)[0]).join("\n") };
    })
    .catch((rolledBack) => {
      if (rolledBack.plan === undefined) throw rolledBack;
      return rolledBack.plan;
    });
  out.push(`\n## ${name}\n`, "```", plan, "```");
  save();
  console.log(name, /Execution Time: ([\d.]+)/.exec(plan)?.[1], "ms");
}

const ctx = { sql, chunk: 10_000, pauseMs: 100, stopping: () => false };
async function timed(name, run) {
  const started = Date.now();
  const rows = await run();
  const line = `${name}: ${rows} rows in ${((Date.now() - started) / 1000).toFixed(1)} s`;
  console.log(line);
  out.push(`- ${line}`);
  save();
}
out.push("", "## Real runs (built job functions, chunk 10 000, 100 ms pause)", "");
await sql`INSERT INTO data_deletions (project_id, kind, user_id) VALUES (${project.id}, 'user', 'explain-user')`;
await timed("user deletion over the whole span", () => runDeletions(ctx));
await sql`INSERT INTO data_deletions (project_id, kind, visitor_id) VALUES (${project.id}, 'visitor', ${visit.visitorId})`;
await timed("visitor deletion over the whole span", () => runDeletions(ctx));
const days = Math.ceil((Date.now() - cutoff.getTime()) / 86_400_000);
await sql`UPDATE projects SET retention_days = ${days} WHERE id = ${project.id}`;
await timed(`retention (${days} days kept, oldest ~30 days cut)`, () => runRetention(ctx));

console.log(`wrote ${file}`);
await sql.end();
