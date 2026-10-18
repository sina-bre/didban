// `pnpm check:packages` (Stage 3 gate, after `pnpm build`): publint + attw on each public package,
// then pack both tarballs, install them into an empty temp project (npm, --ignore-scripts) and
// smoke-run them the way a user would: ESM import in Node (SSR no-op) and the React adapter.
import { execSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const PACKAGES = ["packages/sdk", "packages/react"];
// One quoted command string through the shell (npm/pnpm are .cmd shims on Windows); every part
// is a constant or a path this script made.
const run = (cmd, args, cwd) => {
  const line = [cmd, ...args].map((part) => (/[\s"]/.test(part) ? JSON.stringify(part) : part));
  console.log(`$ ${line.join(" ")}   (${cwd})`);
  const out = execSync(line.join(" "), { cwd, encoding: "utf8", stdio: "pipe" });
  console.log(out.trim());
};

const bin = (name) => resolve("node_modules/.bin", name);
for (const dir of PACKAGES) {
  run(bin("publint"), ["--strict"], dir);
  run(bin("attw"), ["--pack", ".", "--profile", "esm-only"], dir);
}

const work = mkdtempSync(join(tmpdir(), "didban-pack-"));
try {
  for (const dir of PACKAGES) run("pnpm", ["pack", "--pack-destination", work], dir);
  const tarballs = readdirSync(work).filter((f) => f.endsWith(".tgz"));
  if (tarballs.length !== PACKAGES.length) throw new Error(`expected 2 tarballs: ${tarballs}`);
  writeFileSync(join(work, "package.json"), '{ "private": true, "type": "module" }\n');
  const installArgs = ["install", "--no-audit", "--no-fund", "--ignore-scripts"];
  run("npm", [...installArgs, ...tarballs.map((f) => `./${f}`), "react@19", "react-dom@19"], work);
  writeFileSync(
    join(work, "smoke.mjs"),
    `import { createAnalytics } from "@didban/analytics";
import { scrollDepth } from "@didban/analytics/scroll-depth";
import { AnalyticsProvider, useAnalytics } from "@didban/react";
import { readFileSync } from "node:fs";
const a = createAnalytics({ writeKey: "dpk_000000000000_${"x".repeat(43)}", autoCapture: { scrollDepth: scrollDepth() } });
a.track("smoke"); await a.flush(); a.shutdown();
const entry = readFileSync(new URL(import.meta.resolve("@didban/react")), "utf8");
if (!/^["']use client["']/.test(entry)) throw new Error("@didban/react lost its use client directive");
console.log("smoke ok:", typeof AnalyticsProvider, typeof useAnalytics, "(SSR no-op, use client kept)");
`,
  );
  run("node", ["smoke.mjs"], work);
} finally {
  rmSync(work, { recursive: true, force: true });
}
console.log("check-packages: ok");
