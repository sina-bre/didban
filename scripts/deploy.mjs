// Rolling deploy on one box, Linux or Windows (spec §14.2, docs/deployment.md, ADR 0047/0048).
// From a checkout of the version to deploy, as root (Linux) or in an elevated shell (Windows):
//   node scripts/deploy.mjs
// Builds a release, migrates once with the migrator role, switches `current`, publishes the
// dashboard, then restarts instance A, waits for its /ready, restarts instance B. Migrations are
// expand/contract, so the old version keeps working on the new schema while B still runs it.
import { cpSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import {
  assertPrivileged,
  buildRelease,
  layout,
  restartService,
  switchCurrent,
} from "./ops/platform.mjs";
import { capture, log, run } from "./ops/run.mjs";

const SRC = resolve(import.meta.dirname, "..");
const SKIP = new Set([".git", "node_modules", "dist", "test-results", ".claude"]);
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
const release = join(layout.root, "releases", stamp);
const say = (message) => log("deploy", message);

/** Build and migrate; a failure on the way leaves no release behind and changes nothing. */
function prepare() {
  let revision = "?";
  try {
    revision = capture("git", ["-C", SRC, "rev-parse", "--short", "HEAD"]);
  } catch {}
  say(`build ${release} from ${SRC} (${revision})`);
  const keep = (path) => !SKIP.has(basename(path)) && !basename(path).startsWith(".env");
  cpSync(SRC, release, { recursive: true, filter: keep });
  try {
    buildRelease(release);
    say("migrate (once, migrator role)");
    const cwd = join(release, "apps", "api");
    run(process.execPath, [`--env-file=${layout.migratorEnv}`, "dist/db/migrate-cli.js"], { cwd });
  } catch (error) {
    rmSync(release, { recursive: true, force: true });
    throw error;
  }
}

/** New hashed assets first, index.html last; old assets stay 30 days for open tabs. */
function publishDashboard() {
  const dist = join(release, "apps", "dashboard", "dist");
  say(`publish dashboard to ${layout.www}`);
  mkdirSync(layout.www, { recursive: true });
  cpSync(dist, layout.www, { recursive: true, filter: (p) => basename(p) !== "index.html" });
  cpSync(join(dist, "index.html"), join(layout.www, "index.html.next"));
  renameSync(join(layout.www, "index.html.next"), join(layout.www, "index.html"));
  const assets = join(layout.www, "assets");
  const old = Date.now() - 30 * 86_400_000;
  for (const file of readdirSync(assets)) {
    if (statSync(join(assets, file)).mtimeMs < old) rmSync(join(assets, file));
  }
}

async function waitReady(port) {
  for (let i = 0; i < 60; i++) {
    const ok = await fetch(`http://127.0.0.1:${port}/api/v1/health/ready`).then(
      (r) => r.ok,
      () => false,
    );
    if (ok) return;
    await sleep(1000);
  }
  throw new Error(`instance ${port} not ready after 60 s: stopping before the next one`);
}

function prune() {
  const dir = join(layout.root, "releases");
  const all = readdirSync(dir).sort();
  for (const name of all.slice(0, Math.max(0, all.length - layout.keep))) {
    if (name !== stamp) rmSync(join(dir, name), { recursive: true, force: true });
  }
}

assertPrivileged();
if (!existsSync(layout.migratorEnv)) throw new Error(`${layout.migratorEnv} is missing`);
prepare();
say(`switch current -> ${release}`);
switchCurrent(release);
publishDashboard();
for (const port of layout.ports) {
  say(`restart instance ${port}`);
  restartService(port);
  await waitReady(port);
  say(`instance ${port} ready`);
  await sleep(layout.settleMs); // longer than Caddy's health interval: A is back in rotation
}
say(`prune releases (keep ${layout.keep})`);
prune();
say(`done: ${release}`);
