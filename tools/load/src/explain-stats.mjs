// `pnpm -C tools/load explain [projectId]` (Stage 4d): runs every stats use case of the BUILT API
// (apps/api/dist) against the largest project on the local test DB, times it (read-only tx, 10 s
// statement timeout, as in production), captures the exact statements through postgres.js
// `debug`, and re-runs the 90-day ones under EXPLAIN (ANALYZE, BUFFERS). Writes results/plans-*.md.
import { mkdirSync, writeFileSync } from "node:fs";
import postgres from "postgres";
import { localDatabaseUrl } from "./environment.mjs";
import { CASES } from "./explain-cases.mjs";

const url = localDatabaseUrl("TEST_DATABASE_URL");
let captured = [];
const sql = postgres(url, {
  max: 1,
  transform: postgres.camel,
  onnotice: () => {},
  debug: (_connection, query, params) => captured.push({ query, params }),
});
const plain = postgres(url, { max: 1, onnotice: () => {} });

const [project] = await plain`
  SELECT p.id, p.organization_id FROM projects p
  WHERE ${process.argv[2] ?? null}::uuid IS NULL OR p.id = ${process.argv[2] ?? null}::uuid
  ORDER BY (SELECT count(*) FROM visits v WHERE v.project_id = p.id) DESC LIMIT 1`;
const scope = {
  userId: "explain",
  isPlatformAdmin: false,
  organizations: new Map(),
  projects: new Map([
    [project.id, { organizationId: project.organization_id, orgRole: "owner", projectRole: null }],
  ]),
};
const SKIP = /^(begin|commit|set local|select reporting_timezone|select id, identity_mode)/i;

async function plans(statements) {
  const out = [];
  await plain`SET statement_timeout = 0`;
  for (const { query, params } of statements) {
    if (SKIP.test(query.trim())) continue;
    const rows = await plain.unsafe(`EXPLAIN (ANALYZE, BUFFERS) ${query}`, params);
    out.push(
      `\`\`\`sql\n${query.trim().replace(/\s+/g, " ")}\n\`\`\`\n\`\`\`\n${rows.map((r) => r["QUERY PLAN"]).join("\n")}\n\`\`\``,
    );
  }
  return out;
}

const lines = ["| Case | Range | ms | Result |", "|---|---|---|---|"];
const details = [];
for (const c of CASES) {
  for (const days of c.ranges) {
    captured = [];
    const started = performance.now();
    let result = "ok";
    try {
      await c.run(sql, scope, project.id, days);
    } catch (error) {
      result = error.code === "57014" ? "**TIMEOUT (10 s)**" : `error: ${error.message}`;
    }
    const ms = (performance.now() - started).toFixed(0);
    lines.push(`| ${c.name} | ${days} d | ${ms} | ${result} |`);
    console.log(lines.at(-1));
    if (days === 90 && result === "ok")
      details.push(`### ${c.name} (90 d)\n\n${(await plans(captured)).join("\n\n")}`);
  }
}
const [size] =
  await plain`SELECT (SELECT count(*) FROM events WHERE project_id = ${project.id})::int8 AS events,
  (SELECT count(*) FROM visits WHERE project_id = ${project.id})::int8 AS visits`;
const header = `# Stats query plans — ${new Date().toISOString()}\n\nProject ${project.id}: ${size.events} events, ${size.visits} visits.\n`;
const dir = new URL("../results/", import.meta.url);
mkdirSync(dir, { recursive: true });
const file = new URL(`plans-${new Date().toISOString().slice(0, 10)}.md`, dir);
writeFileSync(file, `${header}\n${lines.join("\n")}\n\n## Plans\n\n${details.join("\n\n")}\n`);
console.log(`saved ${file.pathname}`);
await sql.end();
await plain.end();
