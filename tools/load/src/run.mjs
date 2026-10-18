// `pnpm load [scenario ...]`: seeds a project on the local test DB, starts the built API, runs
// the scenarios, prints and saves the measured numbers (tools/load/results/<date>.json).
import { mkdirSync, writeFileSync } from "node:fs";
import postgres from "postgres";
import { startApi } from "./api-process.mjs";
import { brokenBudgets } from "./budgets.mjs";
import { delta, sampleActivity, snapshot } from "./db-stats.mjs";
import { describeEnvironment, localDatabaseUrl } from "./environment.mjs";
import { runScenario } from "./run-scenario.mjs";
import { SCENARIOS } from "./scenarios.mjs";
import { seedTarget } from "./seed.mjs";

// The API under test. One write key carries all traffic, so its per-key limit is lifted; the
// per-IP limit stays at its default (the abusive scenario measures it).
const API_SETTINGS = { TRUST_PROXY: "1", DB_POOL_MAX: "10", INGEST_RATE_PER_KEY: "1000000" };
const PORT = 5390;

const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SCENARIOS);
const unknown = names.filter((name) => !SCENARIOS[name]);
if (unknown.length) throw new Error(`unknown scenario(s): ${unknown.join(", ")}`);

const databaseUrl = localDatabaseUrl("TEST_DATABASE_URL");
const sql = postgres(databaseUrl, { max: 2, onnotice: () => {} });
const target = await seedTarget(sql);
const api = await startApi({ databaseUrl, port: PORT, settings: API_SETTINGS });
const results = {};
try {
  for (const name of names) {
    const scenario = SCENARIOS[name];
    console.log(`→ ${name}: ${scenario.about}`);
    const before = await snapshot(sql, target.projectId);
    const firstSample = api.samples.length;
    const stopSampling = sampleActivity(sql);
    const http = await runScenario(api.base, scenario, target.writeKey);
    const activity = await stopSampling();
    await new Promise((resolve) => setTimeout(resolve, 2000)); // let in-flight batches commit
    const db = delta(before, await snapshot(sql, target.projectId));
    const proc = api.samples.slice(firstSample);
    const rssMaxMb = Math.max(0, ...proc.map((s) => s.rssMb));
    const cpuAvg = proc.reduce((a, s) => a + s.cpuPercent, 0) / Math.max(1, proc.length);
    results[name] = {
      about: scenario.about,
      http,
      db: { ...db, ...activity },
      api: { rssMaxMb, cpuAvg },
    };
    console.log(JSON.stringify(results[name], null, 2));
  }
} finally {
  await api.stop();
}
const report = {
  date: new Date().toISOString(),
  environment: await describeEnvironment(sql),
  api: { ...API_SETTINGS, INGEST_INSERT_CHUNK: "500 (default)", NODE_ENV: "production" },
  results,
};
await sql.end();
const dir = new URL("../results/", import.meta.url);
mkdirSync(dir, { recursive: true });
const stamp = report.date.slice(0, 16).replace(":", "");
const file = new URL(`${stamp}Z-${names.join("-")}.json`, dir);
writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
console.log(`saved ${file.pathname}`);
const broken = Object.entries(results).flatMap(([name, result]) => brokenBudgets(name, result));
for (const line of broken) console.error(`budget broken: ${line}`);
console.log(broken.length ? `${broken.length} budget(s) broken` : "all budgets met");
process.exitCode = broken.length ? 1 : 0;
